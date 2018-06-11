--Description: 将table数据转为string用于打印
--Params: 
--Return: 
--Last Modify: Zahidle.PF
function dumpTableToString( _table , _callnum)
	if( type(_table) ~= "table" ) then
        return tostring(_table);
    end
    
    --标记递归层级，初始为0
    local callNum = 0;
    if( _callnum ) then
        callNum = _callnum;
    end

    --返回当前层级缩进信息
    local printIndentation = function()
        local str = "";
        if( callNum ) then
            for i=1,callNum,1 do
                str = str .. "    ";
            end
        end
        return str;
    end

    local strIndentation = printIndentation();

	local retstr = "[\n";
    for k,v in pairs(_table) do
        print("--" .. tostring(k) .. ":" .. tostring(v));
        local val = dumpTableToString(v,callNum+1);
		retstr = retstr .. strIndentation .. tostring(k) .. " = " .. val .. ";\n";
	end

    retstr = retstr .. strIndentation .. "]";
    
    return retstr;
    
end


aaa = {src = "1111",scoreName = "2222",funcs = {aaa = 1, bbb = 2,ccc = { kkk = "hello1",kkk2 = "hello2" }}}
bbb = {"ttt","yyyy","uuu","iii","eee"}

local ccc = debug.getinfo(1);
ccc = dumpTableToString(ccc);
--local vvv = dumpTableToString(bbb);
print(ccc);


-- local function func(a,b)
--     local count = 0;
--     repeat 
--         print("1");
--         count = count +1;
--         if( count == 50 ) then
--             print("Bingo");
--             yret = coroutine.yield();
--             print("resume:" .. yret);
--         end
--     until count>100;
-- end

-- local function coroutineMain()
--     xpcall(func,function(error)
--         print(error);
--     end);
-- end


-- local aaa = coroutine.create(func);
-- coroutine.resume(aaa,1,1);
-- print("\nRTRTRTTTTTTTTTTTTT");
-- bbb,msg = coroutine.resume(aaa);
-- if( not bbb ) then
--     print(msg);
-- end



-- local function func(a,b)
--     print("resume args:"..a..","..b)
--     local count = 0;
--     repeat 
--         print("1");
--         count = count +1;
--         if( count == 20 ) then
--             yreturn = coroutine.yield()
--             print ("yreturn :"..yreturn)
--         end
   
--     until count>50;
-- end

-- coco = coroutine.create(func)
-- coroutine.resume(coco,0,1)
-- coroutine.resume(coco,21)
