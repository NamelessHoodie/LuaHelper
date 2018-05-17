import { Breakpoint } from "vscode-debugadapter/lib/main";
import { DebugProtocol } from 'vscode-debugprotocol'
import { LuaDebugAdapter } from "./DebugAdapter";
var Path = require('path');
import { readFileSync } from 'fs';



/**
 * 断点数据结构
 */
export class BreakpointInfo
{
    private currentText: string;
	private vindex: number;
	private _breakPoints = new Map<string, Array<number>>();    // 文件名 <---> 文件中所有断点行数列表
	private _breakpointId = 111000;
	private length: number;
	private line: number;
	private isAddLine: boolean;
	private lines: Array<number>;   //记录当前脚本所有断点行数信息
	private lineContent: string = "";
    private da: LuaDebugAdapter;
    


    /**
     * 由文件uri 查询该文件断点信息 
     * 返回pathinfo 结构
     * var pathinfo = {
			fileName: fileName,
			serverPath: path,
			lines: lines
		}
     * @param path 
     */
    public getClientBreakPointInfo(path): any {
		path =  path.replace(/\\/g, "/");
		if (this._breakPoints.has(path)) {

			var breakPoints = this._breakPoints.get(path);
			var pathinfo = this._convertToClientPath(path,breakPoints)
			
			return [pathinfo];
		}
		return null;
	}

    /**
     * 验证所有断点信息并返回一个DebugProtocol.BreakPoint列表
     * @param path 
     * @param berakLines 
     */
    public verifiedBreakPoint(path: string, berakLines: Array<number>):Array<Breakpoint> {

		this.line = 1;
		this.currentText = readFileSync(path).toString();
		this.length = this.currentText.length;
		this.vindex = 0;
		this.lines = new Array<number>();
		while (true) {
			this.isAddLine = true;
			var charCode = this.currentText.charCodeAt(this.vindex);
			var next = this.currentText.charCodeAt(this.vindex + 1);
			if (charCode == 45 && next == 45) {
				//获取评论
				this.skipComment();
				this._skipWhiteSpace();
			} else {
				this.lineContent += this.currentText.charAt(this.vindex);
				if (!this._consumeEOL()) {
					this.vindex++;
				}
			}

			if (this.vindex >= this.length) {
				this._addLine();
				break;
			}
		}
		var count = this.lines.length;

        //返回一个BreakPoint列表
		var breakpoints = new Array<Breakpoint>();
		var luaBreakLines = new Array<number>();
		for (var index = 0; index < berakLines.length; index++) { 

			this._addBreakPoint(berakLines[index], breakpoints, luaBreakLines);
		}

		this._breakPoints.set(path.replace(/\\/g, "/"), luaBreakLines);
		return breakpoints;
		// const bp:DebugProtocol.Breakpoint = new Breakpoint(true, this.convertDebuggerLineToClient(line));

    }

    /**
     * @param line 
     * @param breakpoints 
     * @param luabreakLines 
     */
    _addBreakPoint(line: number, breakpoints: Array<Breakpoint>, luabreakLines: Array<number>) {
		for (var index = 0; index < this.lines.length; index++) {
			var fline = this.lines[index];
			if (fline >= line) {
				if (luabreakLines.indexOf(fline) == -1) {
					const bp:DebugProtocol.Breakpoint = new Breakpoint(true, fline);
					luabreakLines.push(fline);
					breakpoints.push(bp);
					bp.id = ++this._breakpointId;
					bp.verified = true;

				}

				break;
			}
		}
	}
    
  
    /**
     * 记录这一行行数
     */
    _addLine() {
		this.lineContent = this.lineContent.trim();
		if (this.lineContent.length > 0) {
			this.lines.push(this.line);
			this.lineContent = "";
		}
    }
    

    /**
     * 略过注释
     */
    private skipComment(): void {
        //  this.tokenStart = this.vindex;
        this.isAddLine = false
        this.vindex += 2;
        //当前字符
        var character = this.currentText.charAt(this.vindex);
        //注释内容
        var content;
        // 是否为长注释  --[[  长注释 ]]
        var isLong = false;
        var commentStart = this.vindex;
        if ('[' == character) {
            content = this._checkLongString();
            if (content == false) {
                content = character;
            }
            else {
                isLong = true;
            }
        }
        if (!isLong) {

            while (this.vindex < this.length) {
                if (this._isLineTerminator(this.currentText.charCodeAt(this.vindex))) break;
                this.vindex++;
            }

        }
    }


    /**
     * 检测并取出长字符串
     *  * return 
     *          为长字符串 content
     *          不为长字符串  false
     */
    _checkLongString(): any {
        //多少个  等于符号
        var level: number = 0;
        //注释内容  
        var content: string = '';
        var terminator: boolean = false;
        var character: string = null;
        var stringStart: number = 0;
        this.vindex++; //将位置移到 需要判断的字符  上已阶段以及判断到了 [
        // 获取等于符号的多少

        while ('=' === this.currentText.charAt(this.vindex + level)) {
            level++;
        }
        // 如果是[ 那么继续 如果不为 [ 那么 直接返回
        if ('[' !== this.currentText.charAt(this.vindex + level)) {
            return false;
        }
        this.vindex += level + 1;
        if (this._isLineTerminator(this.currentText.charCodeAt(this.vindex))) {
            this._consumeEOL();
        }
        //注释开始的位置
        stringStart = this.vindex;
        // 读取注释内容
        while (this.vindex < this.length) {
            while (true) {
                if (this._isLineTerminator(this.currentText.charCodeAt(this.vindex))) {
                    this._consumeEOL();
                } else {
                    break;
                }
            }

            character = this.currentText.charAt(this.vindex++);

            if (']' == character) {

                terminator = true;
                for (var i = 0; i < level; i++) {
                    if ('=' !== this.currentText.charAt(this.vindex + i)) {
                        terminator = false;
                    }
                }
                if (']' !== this.currentText.charAt(this.vindex + level)) {
                    terminator = false;
                }
            }
            if (terminator) break;

        }
        if (terminator) {
            content += this.currentText.slice(stringStart, this.vindex - 1);
            this.vindex += level + 1;
            this.lineContent = "";
            return content;
        } return false;

    }

    /**
	 * 解析换行
	 */
	_consumeEOL(): boolean {
		var charCode = this.currentText.charCodeAt(this.vindex);
		var peekCharCode = this.currentText.charCodeAt(this.vindex + 1);
		//判断是否换行
		if (this._isLineTerminator(charCode)) {
			if (10 === charCode && 13 === peekCharCode) this.vindex++;
			if (13 === charCode && 10 === peekCharCode) this.vindex++;
			if (this.isAddLine) {
				this._addLine();
			}
			this.line++;
			++this.vindex
			return true;
		}
		return false;
    }
    

    /**
	* 跳过空格
	*/
	private _skipWhiteSpace(): void {
		while (this.vindex < this.length) {
			var charCode = this.currentText.charCodeAt(this.vindex);
			//空格 解析
			if (this._isWhiteSpace(charCode)) {
				this.vindex++;
			}
			//解析换行 
			else if (!this._consumeEOL()) {
				break;
			}
		}
	}

    /**
     * 判断是否是空格
     */
	_isWhiteSpace(charCode): boolean {
		return 9 === charCode || 32 === charCode || 0xB === charCode || 0xC === charCode;
    }
    

    /**
     * 判断是否换行
     */
	_isLineTerminator(charCode): boolean {
		return 10 === charCode || 13 === charCode;
	}



    public getAllClientBreakPointInfo() {
		var data = []

		this._breakPoints.forEach((v, k) => {
				
			var strPath: string = k;
			//进行替换 将本地path 替换为远程
			var pathinfo = this._convertToClientPath(strPath,v);
			data.push(pathinfo);
		});
		return data;
    }

    public _convertToClientPath(path: string, lines: Array<number>): any {
		path = path.replace(/\\/g, "/");
		var nindex: number = path.lastIndexOf("/");
		var fileName: string = path.substring(nindex + 1);
		var extname = Path.extname(path);
		var baseName = Path.basename(path);
		fileName = fileName.substr(0,fileName.length - extname.length) + ".lua";
		path = path.substr(0,path.length - extname.length) + ".lua";
		var pathinfo = {
			fileName: fileName,
			serverPath: path,
			lines: lines
		}
		return pathinfo;
		//检查文件是否存在如果存在那么就
		// var paths: Array<string> = new Array<string>();
		// var clientPath: string = ""
		// for (var index = 0; index < this.scriptPaths.length; index++) {
		// 	var serverPath: string = this.scriptPaths[index];
		// 	if (path.indexOf(serverPath) > -1) {
		// 		clientPath = path.replace(serverPath, "")
		// 		paths.push(clientPath)
		// 	}
		// }
		// return paths;
    }
    

    
    
}