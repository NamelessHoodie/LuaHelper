

/**
 * 这里直接使用luaIDE ScopesManager
 */

//表示一個变量
export class LuaDebugVarInfo {

	public name: string;
	public vars: any;
	public frameId: number;
	public parent: LuaDebugVarInfo;
	public isRoot: boolean;
	public variablesReference: number;
	public variables;
	public varInfos_: Array<LuaDebugVarInfo>;


	/**
	 * 1. local
	 * 2.	up
	 * 3.global
	 */
	public type: number;
	constructor(frameId: number, name: string, type: number, parent: LuaDebugVarInfo) {
		this.frameId = frameId;
		this.name = name;
		this.type = type;
		this.parent = parent;
		this.isRoot = parent == null ? true : false;
	}

	public getVarInfoByName(name: string): any {
		if (this.vars == null) {
			return -1
		} else {
			for (var i = 0; i < this.vars.length; i++) {
				var varName = this.vars[i].name;
				if (name == varName) {
					return this.vars[i];
				}

			}
		}
		return 0
	}
	public getLuaDebugVarInfo(name: string): any {
		if (this.varInfos_ == null) return -1
		for (var i = 0; i < this.varInfos_.length; i++) {
			var luaDebugVarInfo: LuaDebugVarInfo = this.varInfos_[i];
			if (luaDebugVarInfo.name == name) {
				return luaDebugVarInfo;
			}
		}
		return 0
	}
	/**
	 * 添加属于自己的 LuaDebugVarInfo
	 */
	public addLuaDebugVarInfo(luaDebugVarInfo: LuaDebugVarInfo) {
		if (this.varInfos_ == null) {
			this.varInfos_ = new Array<LuaDebugVarInfo>();
		}
		this.varInfos_.push(luaDebugVarInfo);
	}
	public pushVars(vars) {
		if (this.vars == null) {
			this.vars = [];
		}
		for (var i = 0; i < vars.length; i++) {
			var element = vars[i];
			this.vars.push(element);
		}


	}

	public getVarKeys() {
		var keys: Array<string> = new Array<string>();
		var parent: LuaDebugVarInfo = this;
		while (true) {
			if (parent.parent == null) {
				break;
			}

			keys.push(parent.name)
			parent = parent.parent;
		}
		keys = keys.reverse()
		return keys;
	}

}


/**
 * 
 */
export class DebugMonitor
{
    private stackInfos =[];

    public setStackInfos(stackInfos: Array<any>) {
        this.stackInfos = stackInfos;
    }
    
    public getStackInfos(): Array<any> {
        return this.stackInfos
    }
    
}




