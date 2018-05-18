
import child_process = require('child_process');
var path = require('path');


/**
 * Load a runtime or attach to a runtime for debuging.
 */
export class RuntimeLoader 
{
    public childPid: number;

    public constructor() {
    }

    public loadRuntime( args:any ): child_process.ChildProcess
    {
        let platform = process.platform;
        let runtimeType: string = args.runtimeType;
        let localRoots: string[] = [];

        //是否有指定的lua工程目录
        if (args.localRoot) {
            localRoots.push(path.normalize(args.localRoot));   
        }

        var options;
        var luaStartProc;

        if ( platform === "win32" ) {
                var fileName = process.mainModule.filename;
                var fileInfos = fileName.split("out")
                var debugPath =  path.join(fileInfos[0],"luadebug")
                debugPath = debugPath.replace(/\\/g, "/");
                var luaScript = "package.path = package.path .. ';" + debugPath + "/?.lua;"+debugPath + "/luabin;'\n"
                for (let index = 0; index < localRoots.length; index++) {
                    const element = localRoots[index];
                    luaScript += element + "/?.lua;'" 
                }

                luaScript += debugPath + "/luabin;\n"
                luaScript += "require('LuaDebug')('localhost',"+ args.port +")\n"
                luaScript += "require('"+ args.mainFile +"')\n"
                
                options = {
                    encoding: 'utf8',
                    shell: true
                };



            let exePath = debugPath + '/luabin/lua.exe -e "' +luaScript + '"';
            luaStartProc = child_process.execFile(exePath, null, options);
            //luaStartProc = child_process.exec('lua -e "'+luaScript + '"')
        } else if( platform === "darwin") {
            
        }else if( platform === "linux")
        {

        }

        return luaStartProc;

    }
}