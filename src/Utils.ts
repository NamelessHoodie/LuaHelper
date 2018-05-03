
import * as vscode from 'vscode'


import {DocAstInfo,ScopeAstInfo,LuaSyntaxItem,GlobalAstInfo} from './ComAst'
import { ComConfig } from "./ComConfig";



/**
 * 日志系统
 */
export class SysLogger
{
    static isDebug : boolean = true;
    static instance;
    private _logger;
    private _disposable : vscode.Disposable;

    static getSingleton():SysLogger{
        if (SysLogger.instance == null) {
            SysLogger.instance = new SysLogger();
        }

        return SysLogger.instance;
    }

    init()
    {
        //创建自定义日志频道
        this._logger = vscode.window.createOutputChannel("luahelper/log");
        this._logger.show();
        this._disposable = this._logger;
    }

    /**
     * 向console中输出日志
     */
    log( _message:string ) : void
    {
        if (SysLogger.isDebug) {
            console.log(_message);
        }

        this._logger.appendLine(_message);
         
    }

    dispose()
    {
        this._disposable.dispose();
    }
}


exports.Logger = SysLogger.getSingleton();

/**
 * 工具类
 */
export class Utils
{
    /**
     * 格式化路径字符串（将xxx/xxx 格式转化为 xxx.xxx） 
     * @param _path 
     */
    static FormatPath( _path:string) : string
    {
        let str = _path;
        //格式化路径名：将'\'替换为'/后'再替换为'.'
        str = str.replace(/\\/g, "/");
        str =  str.replace(new RegExp("/", "gm"), ".");
        //str = str.toLowerCase();  //大小写敏感
        return str;
    }

    static GetFileNameFromUri( _uri:vscode.Uri):string
    {
        let strRet = Utils.FormatPath(_uri.path);
        strRet = strRet.substr(2);
        //let parts =  strRet.split('.');
        let scriptRoots = ComConfig.GetSingleton().GetScriptRoot();

        for (let index = 0; index < scriptRoots.length; index++) {
            let element = scriptRoots[index].substr(1);
            let rootPath = Utils.FormatPath(element);
            let searchindex = strRet.search(element);
            if( searchindex != -1 )
            {
                strRet = strRet.substr(searchindex+element.length,strRet.length);
                let rets = strRet.split('.');
                if (rets.length>1) {
                    return rets[rets.length-2];
                }

                return rets[rets.length-1];
            }
            
        }


        return null;
    }

    /**
     * 单引号转双引号
     * @param _str 
     */
    static SingleQuotationToDouble( _str:string):string
    {
        return _str.replace(/'/g, "\"");
    }


    /**
     * 获取目标字符串中提示描述信息，提示描述信息在@desc开头表示
     * @param comment 
     */
    private static _GetDescComment(comment: string) {
        var commentStr: string = ""
        var commentIndex: number = comment.indexOf("@desc")
        if (commentIndex > -1) {
            commentStr = comment.substring(commentIndex + 5);
            commentStr = this._TrimCommentStr(commentStr)
            
        } else  {
            if (comment.indexOf("@") == 0) {
                commentStr = ""
            } else {
                commentStr = comment;
            }
    
        }
        return commentStr
    }
    

    /**
     * 去掉目标字符串空格和冒号
     * @param commentStr 
     */
    private static _TrimCommentStr(commentStr: string): string {
        commentStr = commentStr.trim()
        if (commentStr.indexOf(":") == 0) {
            return commentStr.substring(1)
        } else {
            return commentStr
        }
    }



    //返回一个memberexp Node的 string表达式 即 xx.xx.xx
    static MemberExpNodeToString( memberExpNode):string
    {

        if( memberExpNode.type == 'Identifier')
        {
            return memberExpNode.name;
        }
    
        if (memberExpNode.type != 'MemberExpression') {
            return "";
        }

        var ret = Utils.MemberExpNodeToString(memberExpNode.base) +  memberExpNode.identifier;
    }

    //由变量名查找Item
    static findItemByVarName( docAst:DocAstInfo ,  varName:string ):LuaSyntaxItem
    {
        var names = varName.split(/\b(.||:)\b/);

        var getItemFromItemTree = function( itemTree):LuaSyntaxItem
        {
            let index = 0;
            var item = itemTree[names[index]];
            if(item!=undefined)
            {
                for (index = 1; index < names.length; index++) {
                    const element = names[index];
                    item = item.children[element];
                    if(!item)
                    {
                        break;
                    }
                }
    
                if(item)
                {
                    return item; 
                }
                     
            }

            return;
        }

        var item = getItemFromItemTree(GlobalAstInfo.globalItems);
        if(item)return item;
        item = getItemFromItemTree(docAst.scopeAstInfo.localItems);

        return item;
    }


    /**
     * 在指定Scope范围内逐级向上查找指定标识符Item
     * 如 {scope1
     *          {scope2
     *          }
     *          {scope3
     *                {scope4
     *                  
     *                }  
     *          }
     *    }
     *  这里指定在scope4开始查找目标，则查找顺序是scope4->scope3->scope1,找到则立即返回
     * 
     * 
     * @param _keyword      标识符
     * @param _scopeAstInfo 指定Scope
     *          返回值  item为找到的目标Item没有找到则为null 
     *                  isParamItem   表示目标Item是否为一个函数参数
     */

    static findDefinedItemInScopeAstInfo( _indentifier , _scopeAstInfo:ScopeAstInfo ):{item:LuaSyntaxItem,isParamItem:boolean}
    {


        var ret = {item : null,isParamItem : false};
        ret.isParamItem = false;

        if(_scopeAstInfo == null)
        {
            return;
        }

        //找局部
        var item = _scopeAstInfo.localItems.get(_indentifier);
        //找参数
        if(!item)
        {
            item = _scopeAstInfo.paramsItems.get(_indentifier);
            if (item) {
                ret.isParamItem = true;
            }     
        }

        //找上一级
        if(!item)
        {
            var findInParent = this.findDefinedItemInScopeAstInfo(_indentifier,_scopeAstInfo.parent);
            if (findInParent) {
                item = findInParent.item;
                ret.isParamItem = findInParent.isParamItem;
            }
        }

        //如果是顶级scope且是Module则从Module中找
        if (_scopeAstInfo.scopeIndex === 0 && _scopeAstInfo.docAst.moduleTableItem != null) {
            item = _scopeAstInfo.docAst.moduleTableItem.children.get(_indentifier)
        }

        ret.item = item;

        return ret;
    }



}
