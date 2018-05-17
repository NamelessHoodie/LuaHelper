import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSession, LoggingDebugSession , InitializedEvent,TerminatedEvent,
         StoppedEvent, BreakpointEvent, OutputEvent,Thread, StackFrame, Scope, Source, Handles, Breakpoint} from 'vscode-debugadapter';
import { BreakpointInfo } from './BreakPointInfo';
import { LuaDebugServer , EConnState,LuaDebuggerProtocal } from './LuaDebugServer';
import * as child_process from 'child_process';
import { RuntimeLoader } from './RuntimeLoader';


export class LuaDebugAdapter extends LoggingDebugSession
{
    
    public isHitBreak: boolean = false
    _breakPointData:BreakpointInfo;
    _luaDebugServer:LuaDebugServer;
    isPrintToConsole:number;
    runtimeType:string;
    luaStartProc:child_process.ChildProcess;
    runtimeLoader : RuntimeLoader;


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

    protected setupProcessHanlders() {
		this._luaDebugServer.on('C2S_HITBreakPoint', result => {
			//this._luaDebugServer.setStackInfos(result.data.stack)
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
        // build and return the capabilities of this debug adapter:
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


    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void 
    {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		//this._configurationDone.notify();
    }



    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: any) 
    {

        let da = this;
        this.log("launchRequest....");
        this._luaDebugServer = new LuaDebugServer(this, args);

        this.setupProcessHanlders();
        

        this._luaDebugServer.on('ListenerReady', result => {

            da.log("ListenerReady....");
            da.log("loadRuntime....");
            
            //launch lua runtime
            if (da.luaStartProc) {
                da.luaStartProc.kill()
            }

            da.runtimeLoader = new RuntimeLoader();
            da.luaStartProc = da.runtimeLoader.loadRuntime(args);
            
            da.luaStartProc.on('error', error => {
                da.log("error:" + error.message);
            });
            
            da.luaStartProc.stderr.setEncoding('utf8');
            da.luaStartProc.stderr.on('data', error => {
                if (typeof(error) == 'string' ) {
                    da.log("stderr:" + error);
                }
            });


            da.luaStartProc.stdout.setEncoding('utf8');
            da.luaStartProc.stdout.on('data', data => {
                if (typeof(data) == 'string' ) {
                    da.log("stdout:" + data);
                }
            });


            

            da.luaStartProc.on('close', function (code) {
                da.log("close");
                if (da.runtimeLoader.childPid) {
                    try {
                        process.kill(da.runtimeLoader.childPid);
                    }
                    catch (e) {
                        console.log('error..');
                    }
                }
                if(da.runtimeType == "LuaTest"){
                    da.sendEvent(new TerminatedEvent());
                }
                
            });

		})
   

        this.sendResponse(response);
	}
    


    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void 
    {
        if( this._breakPointData == null)
        {
            this._breakPointData = new BreakpointInfo();
        }

		var path = args.source.path;
		var clientLines = args.lines;

        // var breakpoints = this._breakPointData.verifiedBreakPoint(path,clientLines);
		// response.body = {
		// 	breakpoints: breakpoints
        // };
        
        // if (this._luaDebugServer != null && this._luaDebugServer.connState == EConnState.Connected) {
		// 	var data = this._breakPointData.getClientBreakPointInfo(path)
		// 	//这里需要做判断 如果 是 断点模式 那么就需要 用mainSocket 进行发送 如果为运行模式就用 breakPointSocket
        //     this._luaDebugServer.sendMsg(LuaDebuggerProtocal.S2C_SetBreakPoints, data, 
        //         this.isHitBreak == true ? this._luaDebugServer.mainSocket : this._luaDebugServer.breakPointSocket);
        // }
        
        this.sendResponse(response);
        
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

    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void
    {
        
    }

    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void
    {

    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void
    {

    }

    protected reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments) : void 
    {

    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void
    {

    }

    protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void
    {

    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void
    {

    }

} 



DebugSession.run(LuaDebugAdapter);