
import { EventEmitter } from 'events';
import * as net from 'net';
import {LuaDebugAdapter} from './DebugAdapter'
import {
    DebugSession,
    InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent, Event,
    Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from 'vscode-debugadapter';

/**
 * LuaDebugger是lua实现的一个 client脚本运行在调试目标程序上，其调用lua debug库,对目标运行过程进行调试
 * 通过lua socket与 LuaDebugServer进行通信，LuaDebugServer即是DebugAdapter与LuaDebugger的通信代理，
 * DebugAdapter通过DAP与vscode编辑器进行通信，
 * 完整调试过程是 DebugAdapter 收到vscode客户端调试指令（DAP协议），然后传递给LuaDebugServer再传递到LuaDebugger，由LuaDebugger执行具体调试处理
 * 调试反馈由LuaDebugger传递给LuaDebugServer再经DebugAdapter传递给vscode客户端表现
 * 
 * 
 * 
 *                        socket                                               socket
 *luaDebugger  client <------------>     luaDebuggerServer|DA|DapServer <-----------------> Client(vscode editor)
 */

/**
 * LuaDebugServer  <----> LuaDebugger 之间的通信协议
*/
export class LuaDebuggerProtocal {
    public static S2C_SetBreakPoints = 1

    /**断点设置成功 */
    public static C2S_SetBreakPoints = 2
    public static S2C_RUN = 3
    /**命中断点 */
    public static C2S_HITBreakPoint = 4

    public static S2C_ReqVar = 5
    public static C2S_ReqVar = 6
    //单步跳过
    public static S2C_NextRequest = 7
    //单步跳过反馈
    public static C2S_NextResponse = 8
    //没有单步跳过了 直接跳过
    public static S2C_NextResponseOver = 9
    //单步跳入
    public static S2C_StepInRequest = 10
    //单步跳入返回
    public static C2S_StepInResponse = 11

    //单步跳出
    public static S2C_StepOutRequest = 12
    //单步跳出返回
    public static C2S_StepOutResponse = 13

    //单步跳出返回
    public static C2S_LuaPrint = 14


    //执行lua字符串
    public static S2C_LoadLuaScript = 16
    //执行lua字符串
    public static C2S_LoadLuaScript = 18
    //设置socket的名字
    public static C2S_SetSocketName = 17
    
    public static C2S_DebugXpCall = 20

}

/**
 * LuaDebugServer
 */
export class LuaDebugServer extends EventEmitter
{
    recvDatas:string[] = [];
    netServer:net.Server = null;
    connectState:string;
    da:LuaDebugAdapter;
    port: number;
    mainSocket:net.Socket;

    connectionListenner = function( socket ):void
    {
        this.connectState = "connected";
        socket.setEncoding("utf8");

        socket.on("data",(data:string)=>{
            if(!data)
            {
                this.da.sendEvent(new OutputEvent("errordata:\n"));
            }

            this.da.sendEvent(new OutputEvent("data:" + data + "\n"));

            var jsonStr:string = this.recvDatas;
            if(jsonStr) {
               data = jsonStr + data
            }
            //消息分解
            var datas: string[] = data.split("__debugger_k0204__")
            var jsonDatas:Array<any> = new Array<any>();
             for (var index = 0; index < datas.length; index++) {
                    var element = datas[index];
                // luaDebug.sendEvent(new OutputEvent("element:" + element + "\n"))
                if (element == "") {
                    // luaDebug.sendEvent(new OutputEvent("结束" + "\n"))
                    continue;
                }
                if (element == null) {
                    // luaDebug.sendEvent(new OutputEvent("element== null:" + "\n"))
                    continue;
                }


                try {
                    var jdata = JSON.parse(element)
                    jsonDatas.push(jdata)
                } catch (error) {
                    jsonDatas = null
                    this.recvDatas = data;
                    return;
                }

             }

             this.recvDatas = "";

             for (var index = 0; index < jsonDatas.length; index++) {

                var jdata = jsonDatas[index]
                var event: number = jdata.event;


                if (event == LuaDebuggerProtocal.C2S_SetBreakPoints) {
                    var x = 1;
                    //断点设置成
                } else if (event == LuaDebuggerProtocal.C2S_HITBreakPoint) {

                    this.da.isHitBreak = true
                    this.emit("C2S_HITBreakPoint", jdata)
                } else if (event == LuaDebuggerProtocal.C2S_ReqVar) {

                    this.emit("C2S_ReqVar", jdata)
                } else if (event == LuaDebuggerProtocal.C2S_NextResponse) {
                     this.emit("C2S_NextResponse", jdata);
                    // if(this.checkStackTopFileIsExist(jdata.data.stack[0])){
                    //     this.emit("C2S_NextResponse", jdata);
                    // }else
                    // {
                    //      this.sendMsg(LuaDebuggerProtocal.S2C_NextRequest,-1)
                    // }
                }
                else if (event == LuaDebuggerProtocal.S2C_NextResponseOver) {

                    this.emit("S2C_NextResponseOver", jdata);
                } else if (event == LuaDebuggerProtocal.C2S_StepInResponse) {
                    //  if(this.checkStackTopFileIsExist(jdata.data.stack[0])){
                    //      this.emit("C2S_StepInResponse", jdata);
                    // }else
                    // {
                    //     this.sendMsg(LuaDebuggerProtocal.S2C_StepInRequest,-1)
                    // }
                    this.emit("C2S_StepInResponse", jdata);
                   
                } else if (event == LuaDebuggerProtocal.C2S_StepOutResponse) {
                    this.emit("C2S_StepOutResponse", jdata);

                } else if (event == LuaDebuggerProtocal.C2S_LuaPrint) {
                    this.emit("C2S_LuaPrint", jdata);
                } else if (event == LuaDebuggerProtocal.C2S_LoadLuaScript) {
                    if (this.loadLuaCallBack) {
                        this.loadLuaCallBack(
                            {

                                result: jdata.data.msg,
                                variablesReference: 0

                            }
                        );
                        this.loadLuaCallBack = null


                    }
                }
                else if(event == LuaDebuggerProtocal.C2S_DebugXpCall) 
                {
                    this.da.isHitBreak = true
                    this.emit("C2S_HITBreakPoint", jdata)
                }

                else if (event == LuaDebuggerProtocal.C2S_SetSocketName) {
                    if (jdata.data.name == "mainSocket") {
                        this.da.sendEvent(new OutputEvent("client connection!\n"))
                        this.mainSocket = socket;
                       
                        //发送断点信息
                        this.sendAllBreakPoint();
                        //发送运行程序的指令 发送run 信息时附带运行时信息 
                        this.da.isHitBreak = false
                        this.sendMsg(LuaDebuggerProtocal.S2C_RUN,
                            {
                                runTimeType: this.da.runtimeType,
                                isProntToConsole:this.da.isProntToConsole
                               

                            })
                    } else if (jdata.data.name == "breakPointSocket") {
                        this.breakPointSocket = socket;

                    }
                }
            }

        });


        //数据错误事件
        socket.on('error', function (exception) {
            this.da.sendEvent(new OutputEvent('socket error:' + exception + "\n"))

            socket.end();
        });

        //客户端关闭事件
        socket.on('close', function (data) {
            this.da.sendEvent(new OutputEvent('close: ' +
                socket.remoteAddress + ' ' + socket.remotePort + "\n"))
        });

        

    }

    createServer()
    {
        let lds = this;
        this.netServer = net.createServer(this.connectionListenner).listen(this.port);

        //服务器监听事件
        this.netServer.on('listening', function () {

            this.da.sendEvent(new OutputEvent("调试消息端口:" + this.netServer.address().port + "\n"))
        });

        //服务器错误事件
        this.netServer.on("error", function (exception) {
            this.da.sendEvent(new OutputEvent("socket 调试服务器错误:" + exception + "\n"))

        });

    }

    public sendMsg(event: number, data?: any, socket?: net.Socket) {


        var sendMsg = {
            event: event,
            data: data
        }


        try {
            var msg = JSON.stringify(sendMsg)
            var currentSocket: net.Socket = socket;
            if (currentSocket == null) {
                currentSocket = this.mainSocket;

            }

            // this.luaDebug.sendEvent(new OutputEvent("server->send Event:" + msg + "\n"))
            currentSocket.write(msg + "\n");

        } catch (erro) {
            this.da.sendEvent(new OutputEvent("发送消息到客户端错误:" + erro + "\n"))
        }
    }


    public sendAllBreakPoint() {
        var infos = this.da.breakPointData.getAllClientBreakPointInfo()
        this.sendMsg(LuaDebuggerProtocal.S2C_SetBreakPoints, infos, this.mainSocket)
    }

}

