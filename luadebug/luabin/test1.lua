package.path = package.path .. ';E:/Test/LuaVsHelper2/luahelper/luadebug/?.lua;E:/Test/LuaVsHelper2/luahelper/luadebug/luabin;C:/Users/pcp25451/Desktop/LuaTest2/?.lua;'
require('LuaDebug')('localhost',47111);
--require('Main');


-- local socket = require("socket")
-- socket.connect('127.0.0.1', 47111);


-- local socket = require("socket")
-- local host = "localhost"
-- local file = "/"
-- local sock = assert(socket.connect(host, 80))  -- 创建一个 TCP 连接，连接到 HTTP 连接的标准 80 端口上
-- sock:send("GET " .. file .. " HTTP/1.0\r\n\r\n")
-- repeat
--     print(".");
--     local chunk, status, partial = sock:receive(1024) -- 以 1K 的字节块来接收数据，并把接收到字节块输出来
--     print(chunk or partial)
-- until status ~= "closed"
-- sock:close()  -- 关闭 TCP 连接