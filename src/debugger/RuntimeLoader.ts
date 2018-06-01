
import child_process = require('child_process');
var path = require('path');

/**
 * Load a runtime or attach to a runtime for debuging.
 */
export class RuntimeLoader 
{
    public childPid: number;
    da;

    public constructor(da) {
        this.da = da;
    }

    public loadRuntime( args:any ): child_process.ChildProcess
    {

        let platform = process.platform;
        let runtimeType: string = args.runtimeType;
        let localRoots: string[] = [];


        this.da.log('...........localRoot:' + args.localRoot );
        //是否有指定的lua工程目录
        if (args.localRoot) {
            localRoots.push((path.normalize(args.localRoot)).replace(/\\/g, "/"));
        }

        var options;
        var luaStartProc;
       // var targetWorkspace = args.localRoot;


        if ( platform === "win32" ) {

            //debugger runtime路径
            var fileName = __dirname;
            var fileInfos = fileName.split("out")
            var debuggerPath =  path.join(fileInfos[0],"luadebug")
            debuggerPath = debuggerPath.replace(/\\/g, "/");

            this.da.log('debugPath:' + fileName);
            var luaScript = "package.path = package.path .. ';" + debuggerPath + "/?.lua;"+debuggerPath + "/luabin;"// + targetWorkspace + ";'\n"
            for (let index = 0; index < localRoots.length; index++) {
                const element = localRoots[index];
                luaScript += element + "/?.lua;'" 
            }

            luaScript += "require('LuaDebug')('localhost',"+ args.port +")"
            luaScript += "print('end--------0000--------');";
            // luaScript += "ttt = require('LuaDebug');";
            // luaScript += "vvv = require('test1');";
            // //luaScript += "ttt('localhost',"+ args.port +")";
            luaScript += "require('"+ args.mainFile +"')";
            luaScript += "print('end----------------');";
            
            
            options = {
                encoding: 'utf8',
                shell: true
            };

            this.da.log('lua starter:' + luaScript);
            
            let exePath = debuggerPath + '/luabin/lua.exe -e "' +luaScript + '"';
            luaStartProc = child_process.execFile(exePath, options,(error:Error,stdout,stderr)=>{
            //luaStartProc = child_process.exec(exePath, options,(error:Error,stdout,stderr)=>{
                if ( error ) {
                    this.da.log('lua exec has a error');
                } 

                //this.da.log('stdout>>:' + stdout);
                // this.da.log('stderr>>:' + stderr);

            });
            //luaStartProc = child_process.exec('lua -e "'+luaScript + '"')
        } else if( platform === "darwin") {
            
        }else if( platform === "linux")
        {

        }

        return luaStartProc;

    }
}