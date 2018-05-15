

import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSession, LoggingDebugSession , InitializedEvent,TerminatedEvent,
         StoppedEvent, BreakpointEvent, OutputEvent} from 'vscode-debugadapter';

export class LuaDebugAdapter extends LoggingDebugSession
{
    
    public isHitBreak: boolean = false

    constructor()
    {
        super("debugLog.txt");
        // this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);
        

    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, 
                            args: DebugProtocol.InitializeRequestArguments): void 
    {
        try
        {
            // build and return the capabilities of this debug adapter:
            response.body = response.body || {};

            // the adapter implements the configurationDoneRequest.
            response.body.supportsConfigurationDoneRequest = true;
            // make VS Code to use 'evaluate' when hovering over source
            response.body.supportsEvaluateForHovers = true;

            this.sendResponse(response);
            
            this.sendEvent(new InitializedEvent()); 
        }catch(excp)
        {
            console.log("Exception: initializeRequest："+ excp );
        }


        console.log("initializeRequest!!");
    }


    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void 
    {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		//this._configurationDone.notify();
    }



    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: any) 
    {

        this.sendResponse(response);
        console.log("launchRequest!!");
	}
    


    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void 
    {
        this.sendResponse(response);
    }


    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void
    {

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