'use strict';

const key = process.env.PUSHPLUS_KEY;

const url = 'http://dtxtj.gdhuaxun.net:1009//App/DataApi.ashx';
const push_url = `http://www.pushplus.plus/send`;

const loginData = {"Action":"login","UserName":"13923020981","Password":"2D49BE9704D22F8FCD8EF1F766E62C6B","PushID":"eb97cd8bb89843be","IMEI":"","DeviceModel":"TNA-AN00"};

const userListData = {"Action":"ManagementGetUserList","DepartmentEID":"BEAC145175930C20","SearchStr":""};

const getSignRecord = {"Action":"ManagementGetSignInRecord"};
const axios = require('axios');
const dayjs = require('dayjs');
const AxiosLogger = require("axios-logger");

axios.interceptors.request.use(
  AxiosLogger.requestLogger,
  AxiosLogger.errorLogger
);
axios.interceptors.response.use(
  AxiosLogger.responseLogger,
  AxiosLogger.errorLogger
);
const now = dayjs();
const morningStart = now.hour(7).minute(0).second(0).millisecond(0);
const morningEnd = now.hour(11).minute(0).second(0).millisecond(0);

const afternoonStart = now.hour(13).minute(0).second(0).millisecond(0);
const afternoonEnd = now.hour(17).minute(0).second(0).millisecond(0);

const unsignList = [];
const overstepList = [];

const title = '打卡提醒';

let desp = '';

function isMorning() {
    return now.hour() < 12;
}

function isYidi(address) {
    return address === null || !address.includes('丰顺');
}



async function pushMsg(title, content) {
    const data = {
        token: key,
        title,
        content: content.replace("\n", "<br>"),
        template: "json",
    }
    const res = await axios.post(push_url, data);
}

const is_morning = isMorning();

exports.main = async (event, context) => {
    const loginResult = await axios.post(url, loginData);
    const loginDataResult = loginResult.data;
    if (loginDataResult.Code !== 1) {
        desp += '登录失败 \r\n';
        await pushMsg(title, desp);
        return;
    }
    const token = loginDataResult.Data.Token;
    userListData.Token = token;
    getSignRecord.Token = token;
    const userListResult = await axios.post(url, userListData);
    if (userListResult.data.Code !== 1) {
        desp += '获取用户列表失败\r\n';
        await pushMsg(title, desp);
        return;
    }
    const userList = userListResult.data.Data;
    const userLen = userList.length;
    for (let i = 0; i < userLen; i++) {
        const user = userList[i];
        getSignRecord.UserName = user.UserName;
        const getSignRecordResult = await axios.post(url, getSignRecord);
        if (getSignRecordResult.data.Code !== 1) {
            desp += `获取${user.TrueName} ${user.UserName}打卡列表失败 \r\n`;
            continue;
        }
        const signList = getSignRecordResult.data.Data;
        //说明没打卡
        if (signList.length < 1) {
            unsignList.push(user);
            continue;
        }
        const record = signList[0];
        const signInTime = dayjs(record.SignInTime);
        user.address = record.Address;
        user.signInTime = record.SignInTime;
        if (is_morning) {
            if (signInTime.isAfter(morningStart)  && signInTime.isBefore(morningEnd)) {
                if (isYidi(user.address)) {
                    overstepList.push(user);
                }
            } else {
                unsignList.push(user);
            }
        } else {
            if (signInTime.isAfter(afternoonStart)  && signInTime.isBefore(afternoonEnd)) {
                if (isYidi(user.address)) {
                    overstepList.push(user);
                }
            } else {
                unsignList.push(user);
            }
        }
    }
    if (unsignList.length > 0) {
        desp += '未按时打卡人员： \r\n';
        unsignList.forEach(item => {
            desp += `${item.TrueName} ${item.UserName} `;
            // if (item.signInTime) {
            //     desp += `上次打卡时间:${item.signInTime}`;
            // }
            desp += ' \r\n';
        });
    } else {
        desp += '所有人员都已按时打卡 \r\n';
    }
    if (overstepList.length > 0) {
        desp += '越界打卡人员： \r\n';
        overstepList.forEach(item => {
            desp += `${item.TrueName} ${item.UserName}在${item.address}打卡 \r\n`;
        });
    }

    await pushMsg(title, desp);
};
