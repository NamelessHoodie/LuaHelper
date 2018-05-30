
local function func(a,b)
    local count = 0;
    repeat 
        print("1");
        count = count +1;
        if( count == 50 ) then
            print("Bingo");
            yret = coroutine.yield();
            print("resume:" .. yret);
        end
    until count>100;
end

local function coroutineMain()
    xpcall(func,function(error)
        print(error);
    end);
end


local aaa = coroutine.create(func);
coroutine.resume(aaa,1,1);
print("\nRTRTRTTTTTTTTTTTTT");
bbb,msg = coroutine.resume(aaa);
if( not bbb ) then
    print(msg);
end



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