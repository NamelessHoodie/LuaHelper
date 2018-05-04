'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {SysLogger} from './Utils'
import {SysParsor} from './SysParsor'
import {ComConfig} from "./ComConfig"
import { GoDefinitionProvider } from "./providers/LuaDefinitionProvider"
import { LuaCompletionItemProvider } from "./providers/LuaCompletionProvider"
import {TestClassA} from './TestStatic'

const LUA_MODE: vscode.DocumentFilter = { language: 'lua', scheme: 'file' };

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {


    //日志初始化
    SysLogger.getSingleton().init();
    SysLogger.getSingleton().log('Welcome to luahelper!');
    SysLogger.getSingleton().log('Logger init ok...');

    try{
        let diagnosticCollection = vscode.languages.createDiagnosticCollection('lua');
        //分析所有工作区所有lua文档
        let parsor = SysParsor.GetSingleton();
        parsor.setupDiagnosticCollection(diagnosticCollection);
        parsor.DoSth();

        //GotoDefinition
        let dpProvider = vscode.languages.registerDefinitionProvider(
            LUA_MODE,new GoDefinitionProvider()
        );

        //CompletionItemProvider
        let cpProvider = vscode.languages.registerCompletionItemProvider(
            LUA_MODE,new LuaCompletionItemProvider(), '.', ":",'"',"[","@"
        );

        //实时编辑分析
        let onDidChangedisPose = vscode.workspace.onDidChangeTextDocument(event => {

            event.contentChanges.forEach(element => {
               // console.log("change:" + element.text); 
            });

            if (ComConfig.GetSingleton().GetIsChangeTextCheck()) {

                if (event.document.languageId == "lua") {

                    //如果是模板文件忽略
                    if (event.document.uri.fsPath.toLowerCase().indexOf("filetemplates") > -1 || event.document.uri.fsPath.toLowerCase().indexOf("funtemplate") > -1) {
                        return;
                    }
                    
                    var uri = event.document.fileName;
                    SysParsor.GetSingleton().parseOne(event.document.uri,event.document);

                }
                
            }
        });


        //文件系统监听器,监听文件新建,删除事件
        let fswatcher = vscode.workspace.createFileSystemWatcher("**/*.lua");
        fswatcher.onDidCreate(eWithUri=>
        {
            console.log("OnFileCreate:" + eWithUri.fsPath );
            vscode.workspace.openTextDocument(eWithUri).then( 
                doc => {    
                    parsor.parseOne(eWithUri,doc);
                }   
            )

        });

        fswatcher.onDidDelete(eWithUri=>
        {
            console.log("OnFileDelete:" + eWithUri.fsPath );
            parsor.removeOneDocAst(eWithUri);
        });


        context.subscriptions.push(fswatcher);
        context.subscriptions.push(SysLogger.getSingleton());
        context.subscriptions.push(diagnosticCollection);     
        context.subscriptions.push(dpProvider);
        context.subscriptions.push(cpProvider);
        context.subscriptions.push(onDidChangedisPose);
        
    }catch( excp )
    {
        SysLogger.getSingleton().log('Extension Excp:' + excp);
    }
    

}

// this method is called when your extension is deactivated
export function deactivate() {
}