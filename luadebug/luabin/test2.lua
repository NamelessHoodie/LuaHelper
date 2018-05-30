--[[ 
    debug.sethook([thread,] hook, mask [, count])
    将函数"hook"设置为线程"thread"的钩子函数。
    "mask"决定钩子函数何时被触发，"count"决定何时额外的调用一次钩子函数。
    "thread"默认为当前线程。"count"默认为0，
    钩子函数将在每运行"count"条指令时额外的调用一次钩子函数，向钩子函数传递事件"count"。
    "mask"可以指定为如下值的一个或多个：
        'c': 每当Lua调用一个函数时，调用钩子函数，向钩子函数传递事件"call"或"tail call"；
        'r': 每当Lua从一个函数内返回时，调用钩子函数，向钩子函数传递事件"return"；
        'l': 每当Lua进入新的一行时，调用钩子函数，向钩子函数传递事件"line"。
    当钩子函数被调用时，第一个参数是触发这次调用的事件。对于"line"事件，有第二个参数，为当前行号。
    函数不传参，则为关闭钩子函数。
]]

debug.sethook(print, "crl")

function foo()
    local a = 1
    return 2;
end

local x = 1
foo()
local y = 1

debug.sethook();