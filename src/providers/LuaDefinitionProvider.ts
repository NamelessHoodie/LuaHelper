//GotoDefinition 
//跳转到定义F12接口实现

import * as vscode from 'vscode'
import {Utils,SysLogger} from '../Utils'
import { ExceptionInfo } from '_debugger';
import { ComFileAstDirectory } from '../ComFileAstDirectory'
import {GlobalAstInfo ,ELuaSyntaxItemType } from '../ComAst'


export class GoDefinitionProvider implements vscode.DefinitionProvider 
{
    private _disposable : vscode.Disposable;
    private _selectRange : vscode.Selection;
    private _selectPos   : vscode.Position; 
    private _targetDoc  :vscode.TextDocument;

    constructor(){
        let subscriptions : vscode.Disposable[] = [];
        SysLogger.getSingleton().log("DefinitionProvider Created...");
        vscode.window.onDidChangeTextEditorSelection(this.onChangeEditorSelectionEvent,this,subscriptions);
        this._disposable = vscode.Disposable.from( ...subscriptions );

    }

    dispose(){
        this._disposable.dispose();
    }


    /**
     * 选中变化事件
     * @param _event 
     */
    onChangeEditorSelectionEvent( _event:vscode.TextEditorSelectionChangeEvent )
    {
        if(_event.selections.length>0)
        {
            this._selectRange = _event.selections[0];
            
        }
    }


    /**
     * 重载DefinitionProvider.provideDefinition 回调返回的vscode.Location 即是跳转的位置
     * @param document 
     * @param position 
     * @param token 
     */
    public provideDefinition(
        document: vscode.TextDocument, 
        position: vscode.Position, 
        token: vscode.CancellationToken): Thenable<vscode.Location> 
    {

        let location = this._FindDefinition2(document, position);

        return new Promise<vscode.Location>((resolve, reject) => {

            return resolve(location);
        });

    }


    /**
     * 查找目标符号定义
     * @param document  目标符号所在文档
     * @param position  目标符号位置
     */
    _FindDefinition2(document: vscode.TextDocument, position: vscode.Position): vscode.Location 
    {


        var docAstInfo = ComFileAstDirectory.getSingleton().getDocAstInfoWithUri(document.uri.fsPath);

        //let currentFcim : FileCompletionItemManager =  ComLuaCompSetMonitor.instance.getFcim(document.uri);
        this._selectPos = position;
        //获取KeyWord
        let keyword :string = document.getText(this._selectRange);
        //指向关键字自身位置
        let defaultLocation = new vscode.Location(document.uri,position);
        
        //console.log("> "+this._selectRange.anchor.character+ "...." + this._selectRange.active.character);

        //忽略lua语法关键字
        const syntaxOperationMatch = "\\b(\\+|\-|\\%|\\#|\\*|\\/|\^|==|~=|<=|>=)\\b";
        const syntaxOperationMatch2 = "\\b(and|or|not)\\b";
        const syntaxInnerFunctionMatch = "\\b(assert|collectgarbage|dofile|error|getfenv|getmetatable|ipairs|loadfile|loadstring|module|next|pairs|pcall|print|rawequal|rawget|rawset|require|select|setfenv|setmetatable|tonumber|tostring|type|unpack|xpcall)\\b";
        const syntaxLanguageMatch = "\\b(false|nil|true|_G|_VERSION|math)\\b";
        const syntaxControlMatch = "\\b(break|do|else|for|if|elseif|goto|return|then|repeat|while|until|end|function|local|in)\\b";
        try {

            let retIndex:number = -1;
            retIndex = keyword.search(syntaxOperationMatch);//(/\b(and|or|not)\b/g);//new RegExp("\\b(and|or|not)\\b",'g')
            retIndex = keyword.search(syntaxOperationMatch2);
            retIndex = keyword.search(syntaxInnerFunctionMatch);
            retIndex = keyword.search(syntaxLanguageMatch);
            retIndex = keyword.search(syntaxControlMatch);
            if (retIndex != -1 ) 
            {
                //是关键字,指向自己
                return defaultLocation;
            }
        } catch (error) {
            console.log(error.name + ":" + error.message);
        }



        //路径或者模块名判定跳转
        const syntaxPathMatch = "\"\\w+(\/\\w+){0,}\"";
        var lineText = document.lineAt(position.line).text;
        var matchRet = lineText.match(syntaxPathMatch);
        if ( matchRet != null ) {
            var pathStr = matchRet[0];
            pathStr = pathStr.replace(/\"/g,'');
            var moduleName = Utils.FormatPath(pathStr);
            if (moduleName.length > 0) {
                //var uri = LuaFileCompletionItems.GetLuaFileCompletionItems().GetUriCompletionByModuleName(moduleName)
                var uri = ComFileAstDirectory.getSingleton().getUriWithDocName(moduleName);
                if (uri) {
                    var location: vscode.Location =
                        new vscode.Location(uri, new vscode.Position(0, 0))
                    return location;
                }
            }
        }

        //如果当前是函数定义则忽略
        const syntaxFuncDefineMatch = "function\.+(?=\\s*(?:[({\"']|\\[\\[))";
        matchRet = lineText.match(syntaxFuncDefineMatch);
        if ( matchRet != null ) {
            //如果是函数定义取出函数名称对比是否是Key值
            const syntaxFuncParamMatch = ".?([a-zA-Z_][a-zA-Z0-9_]*)(?=\\s*(?:[({\"']|\\[\\[))";
            matchRet = lineText.match(syntaxFuncParamMatch);
            if (matchRet[1] == keyword) {
                return defaultLocation;
            }   
        }

        // //如果当前是变量定义则忽略
        // const syntaxVarientMatch = "([a-zA-Z_][a-zA-Z0-9_]*)\\s*= "
        // matchRet = lineText.match(syntaxVarientMatch);
        // if ( matchRet != null ) {
        //     if(matchRet[0].search(keyword)!=-1)
        //     {
        //         return defaultLocation;
        //     }       
        // }


        //分级取出关键字： 如 xx.xx.keyword 则分别取出祖宗，儿子，孙子...
        var keywords:string[]=[];
        var syntaxkeyWordMatch = "(([a-zA-Z_][a-zA-Z0-9_]*)\\.)*" + keyword;
        matchRet = lineText.match(syntaxkeyWordMatch);
        if ( matchRet != null ) {

            var tempNames: Array<string> = matchRet[0].split('.')
            tempNames.forEach(e => {
                if ( e != "" ) {
                    keywords.push(e);
                }   
            });
        }

        if(keywords.length == 0)
        {
            console.log("Can't find keywords ： " + lineText );
            return;
        }

        this._targetDoc = document;
        var item;

        //先查找keywords[0] 把祖宗找到
        //---------------------------------------------
        //查找DocAstInfo scopeStack 以确定scope按scope查找局部local定义
        try{
            if (docAstInfo.scopeAstStack) {
                for (let i = 0; i < docAstInfo.scopeAstStack.length; i++) {
                    const scopeAstInfo = docAstInfo.scopeAstStack[i];

                    for (let j = 0; j < scopeAstInfo.scope.nodes.length; j++) {
                        const node = scopeAstInfo.scope.nodes[j];
                        if(node.type == 'Identifier')
                        {
                            if (node.name == keywords[0] ) {
                                //Bingo
                                //找局部
                                item = Utils.findDefinedItemInScopeAstInfo(keywords[0],scopeAstInfo);
                                item = item.item;
                                break;
                            }
                        }
                    }

                    if(item)
                    {
                        break;
                    }

                }
            }
        }catch(excp)
        {
            console.log("查找DocAstInfo 错误 :" + excp );
        }

        if(!item)
        {
            var globalItems = GlobalAstInfo.globalItems;
            //查找全局
            item = globalItems.get(keywords[0]);
        }

        //只用查找一级的情况
        if(keywords.length == 1)
        {
            return this._getItemLocation(item);
        }


        //需要查找子孙的情况
        var subitem = null;
        //找到祖宗后找孙子
        if(item)
        {
            //找子孙
            for (let index = 1; index < keywords.length; index++) {
                const subkeyword = keywords[index];
                subitem = item.children.get(subkeyword);
                if(subitem)
                {
                    //找到继续找下一个孙子
                    continue;
                }else
                {
                    //没找到就不用继续找了
                    break;
                }
            }

        }


        if( item && subitem == null)
        {
            //Check祖宗的赋值对象
            if(item.valueItem.type != ELuaSyntaxItemType.Value)
            {
                //找子孙
                for (let index = 1; index < keywords.length; index++) {
                    const subkeyword = keywords[index];
                    subitem = item.valueItem.children.get(subkeyword);
                    if(subitem)
                    {
                        //找到继续找下一个孙子
                        continue;
                    }else
                    {
                        //没找到就不用继续找了
                        break;
                    }
                }
            }
        }

        //最终找到
        if(subitem)
        {
            return this._getItemLocation(subitem);
        }

        return null;
    }




    //跳转
    _getItemLocation(_item)
    {
        if(_item)
        {
            var posCharacter = _item.astNode.loc.start.column;
            var posLine = _item.astNode.loc.start.line-1;
            var location = new vscode.Location(_item.docInfo.doc.uri, new vscode.Position(posLine,posCharacter));
            return location;   
        }
    }


    // _findDefinedItemInScopeAstInfo( _keyword , _scopeAstInfo)
    // {
    //     if(_scopeAstInfo == null)
    //     {
    //         return;
    //     }

    //     //找局部
    //     var item = _scopeAstInfo.localItems.get(_keyword);
    //     if(!item)
    //     {
    //         //参数
    //         item = _scopeAstInfo.paramsItems.get(_keyword);
    //     }


    //     if(!item)
    //     {
    //         return this._findDefinedItemInScopeAstInfo(_keyword,_scopeAstInfo.parent);
    //     }

    //     return item;
    // }

}