
import child_process = require('child_process');
var path = require('path');

/**
 * Load a runtime or attach to a runtime for debuging.
 */
export class RuntimeLoader 
{
    

    constructor()
    {
        
    }


    loadRuntime( args:any ): child_process.ChildProcess
    {
        let platform = process.platform;
        var runtimeType: string = args.runtimeType;
        var localRoot: string = path.normalize(args.localRoot);
        var options;
        var luaStartProc;

        if ( platform === "win32" ) {
                var fileName = process.mainModule.filename;
                var fileInfos = fileName.split("out")
                var debugPath =  path.join(fileInfos[0],"LuaDebug")
                debugPath = debugPath.replace(/\\/g, "/");
                localRoot = localRoot.replace(/\\/g, "/");
                var pathStr = "package.path = package.path .. ';" + debugPath + "/?.lua;" + localRoot + "/?.lua;'"
                pathStr += "print(package.path)"
                pathStr += "require('LuaDebug')('localhost',"+ args.port +")"
            
                pathStr += "require('"+ args.mainFile +"')"
                
                
                options = {
                    encoding: 'utf8',
                    shell: true
                };
            luaStartProc = child_process.exec('lua -e "'+pathStr + '"')
        } else if( platform === "darwin") {
            
        }else if( platform === "linux")
        {

        }

        return luaStartProc;

    }
}