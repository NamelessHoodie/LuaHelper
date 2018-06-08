import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSession, LoggingDebugSession , InitializedEvent,TerminatedEvent,
         StoppedEvent, BreakpointEvent, OutputEvent,Thread, StackFrame, Scope, Source, Handles, Breakpoint} from 'vscode-debugadapter';
import { BreakpointInfo } from './BreakPointInfo';
import { LuaDebugServer , EConnState,LuaDebuggerProtocal } from './LuaDebugServer';
import * as child_process from 'child_process';
import { RuntimeLoader } from './RuntimeLoader';
import { DebugMonitor ,LuaDebugVarInfo} from './DebugMonitor'
var fs = require('fs');
var ospath = require('path');


export class LuaDebugAdapter extends LoggingDebugSession
{
    
    public isHitBreak: boolean = false
    _breakPointData:BreakpointInfo;
    _luaDebugServer:LuaDebugServer;
    _debugMonitor:DebugMonitor;
    isPrintToConsole:number;
    runtimeType:string;
    luaStartProc:child_process.ChildProcess;
    runtimeLoader : RuntimeLoader;
    _fileSuffix : string = ".lua";
    pathMaps: Map<string, Array<string>>;
    public localRoot: string;



    get breakPointData()
    {
        return this._breakPointData;
    }

    constructor()
    {
        super("debugLog.txt");
        // this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);

    }


    public log( msg:string )
    {
        this.sendEvent(new OutputEvent(msg + "\n"));
    }

    //data數據結構
    /**data[
     *      stack = [1：[
     *                  src         = 
     *                  scoreName   =
     *                  currentline =
     *                  linedefined =
     *                  what        =
     *                  nameWhat    =
     *              ]];
     *      vars =  [
     *                  1:var1;
     *                  2:var2;
     *              ]
     *      funcs = [
     *                  1:func1;
     *                  2:func2;                 
     *              ]
     *      event = "C2S_HITBreakPoint"
     *      funcsLength = #funcs
     * ]
     * 
    **/
    protected setupProcessHanlders() {
		this._luaDebugServer.on('C2S_HITBreakPoint', result => {
			this._debugMonitor.setStackInfos(result.data.stack)
			this.sendEvent(new StoppedEvent('breakpoint', 1));
		})
		this._luaDebugServer.on('C2S_LuaPrint', result => {
            this.log("lua: " + result.data.msg);
		})

	}

    protected initializeRequest(response: DebugProtocol.InitializeResponse, 
                            args: DebugProtocol.InitializeRequestArguments): void 
    {

        this.log("initializeRequest....");

        this.pathMaps = new Map<string, Array<string>>();

        //配置DA是否支持一些可选的功能
        // config the capabilities of this debug adapter
        response.body = response.body || {};
        // the adapter implements the configurationDoneRequest.
        response.body.supportsConfigurationDoneRequest = true;
        // make VS Code to use 'evaluate' when hovering over source
        response.body.supportsEvaluateForHovers = true;

        this.sendEvent(new InitializedEvent()); 
        this.sendResponse(response);       

        this.on("close", (event, self:LuaDebugAdapter = this) => {
            self._luaDebugServer.close();
        });
            
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: any) 
    {

        if ( args.noDebug === true ) {
            this.shutdown();
            return;
        }

        let da = this;
        this.log("launchRequest....");

        this._luaDebugServer = new LuaDebugServer(this, args);
        this._debugMonitor = new DebugMonitor(this._luaDebugServer,this);

        this.runtimeType = args.runtimeType
        this.localRoot = args.localRoot;
        this.setupProcessHanlders();
        

        this._luaDebugServer.on('ListenerReady', result => {

            da.log("ListenerReady....");
            da.log("loadRuntime....");
            
            //launch lua runtime
            if (da.luaStartProc) {
                da.luaStartProc.kill()
            }

            da.runtimeLoader = new RuntimeLoader(this);
            da.luaStartProc = da.runtimeLoader.loadRuntime(args);
            
            da.luaStartProc.on('error', error => {
                da.log("error:" + error.message);
            });
            
            da.luaStartProc.stderr.setEncoding('utf8');
            da.luaStartProc.stderr.on('data', error => {
                if (typeof(error) == 'string' ) {
                    da.log("stderr:-------------------------------------------");
                    da.log( error );
                }
            });


            da.luaStartProc.stdout.setEncoding('utf8');
            da.luaStartProc.stdout.on('data', data => {
                if (typeof(data) == 'string' ) {
                    da.log("stdout:-------------------------------------------");
                    da.log( data );
                }
            });


            da.luaStartProc.on('close', function (code) {
                da.log("da process close");
                if (da.runtimeLoader.childPid) {
                    try {
                        process.kill(da.runtimeLoader.childPid);
                    }
                    catch (e) {
                        da.log('error..');
                    }
                }
                if(da.runtimeType == "standalone"){
                    da.sendEvent(new TerminatedEvent());
                }
                
            });

		})
   

        this.sendResponse(response);
	}


    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void 
    {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		//this._configurationDone.notify();
    }

    
    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void 
    {

        this.log("setBreakPointsRequest....");
        if( this._breakPointData == null)
        {
            this._breakPointData = new BreakpointInfo();
        }

		var path = args.source.path;
		var clientLines = args.lines;

        var breakpoints:DebugProtocol.Breakpoint[] = this._breakPointData.verifiedBreakPoint(path,clientLines);

        var breakInfoStr = "";
        breakpoints.forEach(element => {
            breakInfoStr += element.line;
        });

		response.body = {
			breakpoints: breakpoints
        };
        
        if (this._luaDebugServer != null && this._luaDebugServer.connState == EConnState.Connected) {
			var data = this._breakPointData.getClientBreakPointInfo(path)
			//这里需要做判断 如果 是 断点模式 那么就需要 用mainSocket 进行发送 如果为运行模式就用 breakPointSocket
            // this._luaDebugServer.sendMsg(LuaDebuggerProtocal.S2C_SetBreakPoints, data, 
            //     this.isHitBreak == true ? this._luaDebugServer.mainSocket : this._luaDebugServer.breakPointSocket);
            this._luaDebugServer.sendMsg(LuaDebuggerProtocal.S2C_SetBreakPoints, data, this._luaDebugServer.mainSocket);
        }
        
        this.sendResponse(response);
        this.log("setBreakPointsResponse....");
        
    }

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		if (this.luaStartProc) {
			this.luaStartProc.kill()
		}
		super.disconnectRequest(response, args);
	}


    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void
    {
		response.body = {
			threads: [
				new Thread(1, "thread 1")
			]
		};
		this.sendResponse(response);
    }

    

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void
    {
        this.log("stackTraceRequest....");

        var stackInfos: Array<any> = this._debugMonitor.getStackInfos()
		const frames = new Array<StackFrame>();
        
        //this.log("111111111111...." + stackInfos.length );
		for (var i = 0; i < stackInfos.length; i++) {
            
            var stacckInfo = stackInfos[i];
            //this.log("111111111111000..");
			var path: string = stacckInfo.src;
			if (path == "=[C]") {
                path = ""
                //this.log("111111111111001..");
			} else {
				if (path.indexOf(this._fileSuffix) == -1) {
					path = path + this._fileSuffix;
                }
                //this.log("111111111111002.." + path );
				path = this.convertToServerPath(path)
            }
            
            //this.log("111111111111XXX...." + path);
			var tname = path.substring(path.lastIndexOf("/") + 1)
			var line = stacckInfo.currentline
		
			frames.push(new StackFrame(i, stacckInfo.scoreName,
				new Source(tname, path),
                line))
        }
        
        //this.log("22222222222222....:::" + frames.length );

		response.body = {
			stackFrames: frames,
			totalFrames: frames.length
        };
        
        //this.log("3333333333333....");

        this.sendResponse(response);
        
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void
    {
        this.log("scopesRequest.... frameID:" + args.frameId);

        const scopes = this._debugMonitor.createScopes(args.frameId)
		response.body = {
			scopes: scopes
		};
		this.sendResponse(response);

    }

    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void
    {
        this.log("variablesRequest....");

        var da: LuaDebugAdapter = this;
		var luaDebugVarInfo: LuaDebugVarInfo = this._debugMonitor.getDebugVarsInfoByVariablesReference(args.variablesReference)
		if (luaDebugVarInfo) {
			this._debugMonitor.getVarsInfos(args.variablesReference,
				function (variables) {
					response.body = {
						variables: variables
					};
					da.sendResponse(response);
				});
		}
		else {
			this.sendResponse(response)
		}
    }

    //跳过 F5
    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void
    {
        this.log("continueRequest....");
        this._debugMonitor.clear()
		//this.isHitBreak = false
		this._luaDebugServer.sendMsg(LuaDebuggerProtocal.S2C_RUN,
			{
				runTimeType: this.runtimeType,
			})
		this.sendResponse(response);
    }

    protected reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments) : void 
    {
        this.log("reverseContinueRequest....");
    }

    //单步跳过 F10
    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void
    {
        this.log("nextRequest....");
        this._debugMonitor.clear()
		var da = this;
		// this.sendEvent(new OutputEvent("nextRequest 单步跳过-->"))
		// if (this.scopesManager_) {
		// 	this.sendEvent(new OutputEvent("scopesManager_ not null"))
		// } else {
		// 	this.sendEvent(new OutputEvent("scopesManager_ null"))
		// }
		function callBackFun(isstep, isover) {
			// luadebug.sendEvent(new OutputEvent("nextRequest 单步跳过"))
            // luadebug.sendEvent(new OutputEvent("isstep:" + isstep))
            da.log("单步跳过...." + isstep);
			if (isstep) {
				da.sendEvent(new StoppedEvent("step", 1));
			}
		}
		try {
			this._debugMonitor.stepReq(callBackFun, LuaDebuggerProtocal.S2C_NextRequest)
		} catch (error) {
			this.sendEvent(new OutputEvent("nextRequest error:" + error))
		}
		this.sendResponse(response);
    }

	/**
	 * 单步跳入
	 */
    protected stepInRequest(response: DebugProtocol.StepInResponse): void 
    {
        this.log("stepInRequest....");
		this._debugMonitor.clear();
		var da = this;
		this._debugMonitor.stepReq(function (isstep, isover) {
                if (isover) {
                    this.sendEvent(new TerminatedEvent());
                    return;
                }
                if (isstep) {
                    da.sendEvent(new StoppedEvent("step", 1));
                }
            },
             LuaDebuggerProtocal.S2C_StepInRequest
        );
		da.sendResponse(response);
    }
    
	protected pauseRequest(response: DebugProtocol.PauseResponse): void {
		this.sendResponse(response);
		// this.rubyProcess.Run('pause');
	}


    //取变量值
    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void
    {
        this.log("evaluateRequest....");
    }

    public convertToServerPath(path: string): string {
		if (path.indexOf('@') == 0) {
			path = path.substring(1);
		}
		path = path.replace(/\\/g, "/");
        path = path.replace(new RegExp("/./", "gm"), "/");
        
        this.log("33333333");
		var nindex: number = path.lastIndexOf("/");
		var fileName: string = path.substring(nindex + 1);

		fileName = fileName.substr(0,fileName.length - 4) + this._fileSuffix;
		path = path.substr(0,path.length - 4)  + this._fileSuffix;

        this.log("444444444444:" + path);
        var paths: Array<string> = this.pathMaps.get(fileName);
		if (!paths) {
			return path;
		}
		var clientPaths = path.split("/");

        this.log("555555555555" + paths);
		var isHit: boolean = true;
		var hitServerPath = "";
		var pathHitCount: Array<number> = new Array<number>();
		for (var index = 0; index < paths.length; index++) {
			var serverPath = paths[index];
			pathHitCount.push(0);
			var serverPaths = serverPath.split("/");
			var serverPathsCount = serverPaths.length;
			var clientPathsCount = clientPaths.length;
			while (true) {

				if (clientPaths[clientPathsCount--] != serverPaths[serverPathsCount--]) {
					isHit = false;
					break;
				} else {
					pathHitCount[index]++;
				}
				if (clientPathsCount <= 0 || serverPathsCount <= 0) {
					break;
				}
			}
		}
		//判断谁的命中多 
        this.log("666666666666");

		var maxCount = 0;
		var hitIndex = -1;
		for (var j = 0; j < pathHitCount.length; j++) {
			var count = pathHitCount[j];
			if (count >= maxCount && count > 0) {
				hitIndex = j;
				maxCount = count;
			}
		}
		if (hitIndex > -1) {
			return paths[hitIndex];
		}

    }
    
    private initPathMaps(scripts: Array<string>) {
		var paths: Array<string> = new Array<string>();
		if (scripts) {
			for (var index = 0; index < scripts.length; index++) {
				var scriptPath = scripts[index]
				scriptPath = scriptPath.replace(/\\/g, "/");
				if (scriptPath.charAt(scriptPath.length - 1) != "/") {
					scriptPath += "/"
				}
				paths.push(ospath.normalize(scriptPath))
			}
		}
		paths.push(ospath.normalize(this.localRoot))

		function sortPath(p1, p2) {
			if (p1.length < p2.length) return 0
			else return 1
		}
		paths = paths.sort(sortPath);
		var tempPaths: Array<string> = Array<string>();
		tempPaths.push(paths[0])
		for (var index = 1; index < paths.length; index++) {
			var addPath = paths[index];
			var isAdd = true
			for (var k = 0; k < tempPaths.length; k++) {
				if (addPath == tempPaths[k] || addPath.indexOf(tempPaths[k]) > -1 || tempPaths[k].indexOf(addPath) > -1) {
					isAdd = false
					break;
				}
			}
			if (isAdd) {
				tempPaths.push(addPath)
			}
		}

		this.pathMaps.clear();
		for (var k = 0; k < tempPaths.length; k++) {
			this.readFileList(tempPaths[k])
		}
    }
    
    private readFileList(path: string) {
		if (path.indexOf(".svn") > -1) {
			return
		}
		path = path.replace(/\\/g, "/");
		if (path.charAt(path.length - 1) != "/") {
			path += "/"
		}
		var files = fs.readdirSync(path);
		for (var index = 0; index < files.length; index++) {

			var filePath = path + files[index];

			var stat = fs.statSync(filePath);
			if (stat.isDirectory()) {
				//递归读取文件
				this.readFileList(filePath)
			} else {
				if (filePath.indexOf(this._fileSuffix) > -1) {


					var nindex: number = filePath.lastIndexOf("/");
					var fileName: string = filePath.substring(nindex + 1)
					var filePaths: Array<string> = null
					if (this.pathMaps.has(fileName)) {
						filePaths = this.pathMaps.get(fileName)
					} else {
						filePaths = new Array<string>();
						this.pathMaps.set(fileName, filePaths);

					}
					filePaths.push(filePath)
				}
			}
		}
	}

} 



DebugSession.run(LuaDebugAdapter);