-- @util image_tables
-- this stores image data that gets displayed, for example the button press icons.
require("gd")

local img_1_dir_small = gd.createFromPng("lua/images/small/1_dir.png"):gdStr()
local img_2_dir_small = gd.createFromPng("lua/images/small/2_dir.png"):gdStr()
local img_3_dir_small = gd.createFromPng("lua/images/small/3_dir.png"):gdStr()
local img_4_dir_small = gd.createFromPng("lua/images/small/4_dir.png"):gdStr()
local img_5_dir_small = gd.createFromPng("lua/images/small/5_dir.png"):gdStr()
local img_6_dir_small = gd.createFromPng("lua/images/small/6_dir.png"):gdStr()
local img_7_dir_small = gd.createFromPng("lua/images/small/7_dir.png"):gdStr()
local img_8_dir_small = gd.createFromPng("lua/images/small/8_dir.png"):gdStr()
local img_9_dir_small = gd.createFromPng("lua/images/small/9_dir.png"):gdStr()
local img_LP_button_small = gd.createFromPng("lua/images/small/LP_button.png"):gdStr()
local img_MP_button_small = gd.createFromPng("lua/images/small/MP_button.png"):gdStr()
local img_HP_button_small = gd.createFromPng("lua/images/small/HP_button.png"):gdStr()
local img_LK_button_small = gd.createFromPng("lua/images/small/LK_button.png"):gdStr()
local img_MK_button_small = gd.createFromPng("lua/images/small/MK_button.png"):gdStr()
local img_HK_button_small = gd.createFromPng("lua/images/small/HK_button.png"):gdStr()

local img_dir_small = {
    img_1_dir_small, -- 0
    img_2_dir_small, -- 1
    img_3_dir_small, -- 2
    img_4_dir_small, -- 3
    img_5_dir_small, -- 4
    img_6_dir_small, -- 5
    img_7_dir_small, -- 6
    img_8_dir_small, -- 7
    img_9_dir_small -- 8
}

local img_button_small = {
    img_LP_button_small = img_LP_button_small,
    img_MP_button_small = img_MP_button_small,
    img_HP_button_small = img_HP_button_small,
    img_LK_button_small = img_LK_button_small,
    img_MK_button_small = img_MK_button_small,
    img_HK_button_small = img_HK_button_small
}

local img_1_dir_big = gd.createFromPng("lua/images/big/1_dir.png"):gdStr()
local img_2_dir_big = gd.createFromPng("lua/images/big/2_dir.png"):gdStr()
local img_3_dir_big = gd.createFromPng("lua/images/big/3_dir.png"):gdStr()
local img_4_dir_big = gd.createFromPng("lua/images/big/4_dir.png"):gdStr()
local img_5_dir_big = gd.createFromPng("lua/images/big/5_dir.png"):gdStr()
local img_6_dir_big = gd.createFromPng("lua/images/big/6_dir.png"):gdStr()
local img_7_dir_big = gd.createFromPng("lua/images/big/7_dir.png"):gdStr()
local img_8_dir_big = gd.createFromPng("lua/images/big/8_dir.png"):gdStr()
local img_9_dir_big = gd.createFromPng("lua/images/big/9_dir.png"):gdStr()
local img_no_button_big = gd.createFromPng("lua/images/big/no_button.png"):gdStr()
local img_L_button_big = gd.createFromPng("lua/images/big/L_button.png"):gdStr()
local img_M_button_big = gd.createFromPng("lua/images/big/M_button.png"):gdStr()
local img_H_button_big = gd.createFromPng("lua/images/big/H_button.png"):gdStr()

local img_dir_big = {
    img_1_dir_big, -- 0
    img_2_dir_big, -- 1
    img_3_dir_big, -- 2
    img_4_dir_big, -- 3
    img_5_dir_big, -- 4
    img_6_dir_big, -- 5
    img_7_dir_big, -- 6
    img_8_dir_big, -- 7
    img_9_dir_big -- 8
}

local img_button_big = {img_no_button_big = img_no_button_big, img_L_button_big = img_L_button_big, img_M_button_big = img_M_button_big, img_H_button_big = img_H_button_big}

return {img_dir_small = img_dir_small, img_dir_big = img_dir_big, img_button_small = img_button_small, img_button_big = img_button_big}
