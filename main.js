const superagent = require("superagent"); //发送网络请求获取DOM
const cheerio = require("cheerio"); //能够像Jquery一样方便获取DOM节点
const nodemailer = require("nodemailer"); //发送邮件的node插件
const ejs = require("ejs"); //ejs模版引擎
const fs = require("fs"); //文件读写
const path = require("path"); //路径配置

//隐私数据项
const ys_startDay = process.env.YS_STARTDAY;
const ys_marryDay = process.env.YS_MARRYDAY;
const ys_local = process.env.YS_LOCAL;
const ys_from_email = process.env.YS_FROM_EMAIL;
const ys_from_email_pwd = process.env.YS_FROM_EMAIL_PWD;
const ys_to_email = process.env.YS_TO_EMAIL;


//恋爱纪念日
let startDay = ys_startDay;
//结婚纪念日
let marryDay = ys_marryDay;
//当地拼音,需要在下面的墨迹天气url确认
const local = ys_local;

//发送者邮箱厂家
let EmianService = "QQ";
//发送者邮箱账户SMTP授权码
let EamilAuth = {
  user: ys_from_email,
  pass: ys_from_email_pwd
};
//发送者昵称与邮箱地址
let EmailFrom = '老公 ' + ys_from_email;

//接收者邮箱地
let EmailTo = ys_to_email;
//邮件主题
let EmailSubject = "一封暖暖的小邮件";


// 爬取数据的url
const OneUrl = "http://wufazhuce.com/";
// const WeatherUrl = "https://tianqi.moji.com/weather/china/" + local;
const WeatherUrl = "http://tianqi.moji.com/";

let OneDayUrl = 'http://sentence.iciba.com/index.php?callback=jQuery19006060045921437351_1551711862314&c=dailysentence&m=getTodaySentence&_=1551711862318';


// 获取ONE内容
function getOneData(){
    let p = new Promise(function(resolve,reject){
        superagent.get(OneUrl).end(function(err, res) {
            if (err) {
                reject(err);
            }
            let $ = cheerio.load(res.text);
            let selectItem = $("#carousel-one .carousel-inner .item");
            let todayOne = selectItem[0];
            let todayOneData = {
              imgUrl: $(todayOne)
                .find(".fp-one-imagen")
                .attr("src"),
              type: $(todayOne)
                .find(".fp-one-imagen-footer")
                .text()
                .replace(/(^\s*)|(\s*$)/g, ""),
              text: $(todayOne)
                .find(".fp-one-cita")
                .text()
                .replace(/(^\s*)|(\s*$)/g, "")
            };
            resolve(todayOneData)
          });
    })
    return p
}

// 获取天气提醒
function getWeatherTips(){
    let p = new Promise(function(resolve,reject){
        superagent.get(WeatherUrl).end(function(err, res) {
            if (err) {
                reject(err);
            }
            let threeDaysData = [];
            let weatherTip = "";
            let $ = cheerio.load(res.text);
            $(".wea_tips").each(function(i, elem) {
              weatherTip = '亲爱的：' + $(elem)
                .find("em")
                .text();
            });
            resolve(weatherTip)
          });
    })
    return p
}

// 获取每日一句
function getOneDayTips(){
 
    let p = new Promise(function(resolve,reject){
      superagent.post(OneDayUrl)
        .end(function(err,res){
      if(err){
         console.log(err);
      }
      // console.log(res.text)
      let start = res.text.indexOf('content')
      let end = res.text.indexOf('note')
      let end1 = res.text.indexOf('translation')
      let content = res.text.substring(start+10, end-3)
      let note = res.text.substring(end+7, end1-3)
      try {
       note = eval("'" + note + "'")
      } catch (e) {
       note = note
      }
      try {
       content = eval("'" + content + "'")
      } catch (e) {
       content = content
      }

      let oneDayObj = {
        msg1 : content,
        msg2 : note
      }

      console.log(oneDayObj)
      resolve(oneDayObj)
  })
    })
    return p
}


// 获取天气预报
function getWeatherData(){
    let p = new Promise(function(resolve,reject){
        superagent.get(WeatherUrl).end(function(err, res) {
            if (err) {
                reject(err);
            }
            let threeDaysData = [];
            let weatherTip = "";
            let $ = cheerio.load(res.text);
            $(".forecast .days").each(function(i, elem) {
              const SingleDay = $(elem).find("li");
              threeDaysData.push({
                Day: $(SingleDay[0])
                  .text()
                  .replace(/(^\s*)|(\s*$)/g, ""),
                WeatherImgUrl: $(SingleDay[1])
                  .find("img")
                  .attr("src"),
                WeatherText: $(SingleDay[1])
                  .text()
                  .replace(/(^\s*)|(\s*$)/g, ""),
                Temperature: $(SingleDay[2])
                  .text()
                  .replace(/(^\s*)|(\s*$)/g, ""),
                WindDirection: $(SingleDay[3])
                  .find("em")
                  .text()
                  .replace(/(^\s*)|(\s*$)/g, ""),
                WindLevel: $(SingleDay[3])
                  .find("b")
                  .text()
                  .replace(/(^\s*)|(\s*$)/g, ""),
                Pollution: $(SingleDay[4])
                  .text()
                  .replace(/(^\s*)|(\s*$)/g, ""),
                PollutionLevel: $(SingleDay[4])
                  .find("strong")
                  .attr("class")
              });
            });
            resolve(threeDaysData)
          });
    });
    return p
}

// 发动邮件
function sendMail(HtmlData) {
    const template = ejs.compile(
      fs.readFileSync(path.resolve(__dirname, "email.ejs"), "utf8")
    );
    const html = template(HtmlData);
    console.log(html)
    let transporter = nodemailer.createTransport({
      service: EmianService,
      port: 465,
      secureConnection: true,
      auth: EamilAuth
    });
  
    let mailOptions = {
      from: EmailFrom,
      to: EmailTo,
      subject: EmailSubject,
      html: html
    };
    transporter.sendMail(mailOptions, (error, info={}) => {
      if (error) {
        console.log(error);
        sendMail(HtmlData); //再次发送
      }
      console.log("邮件发送成功", info.messageId);
    });
  }

// 聚合
function getAllDataAndSendMail(){
    let HtmlData = {};
    // how long with
    let today = new Date();
    console.log(today)
    let initDay = new Date(startDay);
	let startMarryDay = new Date(marryDay);
    let lastDay = Math.floor((today - initDay) / 1000 / 60 / 60 / 24);
	let marriageDay = Math.floor((today - startMarryDay) / 1000 / 60 / 60 / 24);
    let todaystr =
      today.getFullYear() +
      " / " +
      (today.getMonth() + 1) +
      " / " +
      today.getDate();
    
    HtmlData["lastDay"] = lastDay;
    HtmlData["todaystr"] = todaystr;
	HtmlData["marriageDay"] = marriageDay;

    Promise.all([getOneData(),getOneDayTips(),getWeatherData()]).then(
        function(data){
            HtmlData["todayOneData"] = data[0];
            HtmlData["oneDayInfoObj"] = data[1];
            HtmlData["threeDaysData"] = data[2];
            sendMail(HtmlData)
        }
    ).catch(function(err){
        getAllDataAndSendMail() //再次获取
        console.log('获取数据失败： ',err);
    })
}


getAllDataAndSendMail();