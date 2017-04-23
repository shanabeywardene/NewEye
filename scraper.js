// process.env.TZ
var cheerio = require('cheerio');
var request = require('request');
var jf = require('jsonfile');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.engine('.ejs', require('ejs').__express);
app.use(bodyParser.json());

var plivo = require('plivo');
var api = plivo.RestAPI({
    authId:'MAODGWMDUXYWM4MWZIZJ',
    authToken:'ZWExOWU3YTM1ZTZmODJkMjQ2OWMyMmZiNjVlNTYx'
});

//-- End of requires

var file = './app.json',
    formerDataFile = './formerData.json',
    formerData = {
        title : null
    },
    keywords = null,
    numbers = null,
    priceChart = null;

var historyFile = 'history.json',
    historyLength = 30;

var HOST = 'http://ikman.lk/';
var page =  HOST + 'en/ads/sri-lanka/cars';

//http://ikman.lk/en/ads/sri-lanka/cars

app.get('/', function(req, res) {
    jf.readFile(file, function(err, data) {
        res.render('app.ejs', {
            data : data,
            title: "Scraper Parameters"
        });
    });
});

app.post('/', function(req, res) {
    var keywords = req.body.keywords;
    var numbers = req.body.numbers;
    var pricechart = req.body.pricechart;
    var data;

    //TODO validations
    try{
        data = {
            keywords : JSON.parse(keywords),
            numbers : JSON.parse(numbers),
            pricechart : JSON.parse(pricechart)
        }
    } catch(e) { return res.json({err: 'Invalid format of data.'}); }

    jf.writeFile(file, data, function(err) {
        if(err) {
            console.log('write file error')
            return res.json({err:err});
        }
        res.send('success');
    });
});

app.listen(8080);
console.log('Express app started on port %d', 8080);

function getData(callback) {
    /* Prepering data */
    var _ = console.log,
        self,
        queue,
        chain;
    chain = ({
        historyState: function () {
            return this.history != undefined;
        },
        historyExists: function (url) {
            return (this.history.indexOf(url)+1);
        },
        historyWrite: function (url) {
            while (this.history.length >= historyLength-1) {
                this.history.shift();
            }
            this.history.push(url);
            jf.writeFile(historyFile, this.history, function(error, data) {
                if(error) {
                    self.E(error);
                }
                return self;
            });
        },
        /* object chain */
        init: function (fd) {
            self = this;
            jf.readFile(historyFile, function(error, json) {
                self.E(error)||self.parseRequest(json, fd);
                return self;
            });
        },
        parseRequest: function (history, fd) {
            self = this;
            self.history = history;
            request(page, function (error, response, body) {
                var $, i, il,
                    url, loc, item, //topItem
                    itemList, datePosted, 
                    data;
                if (error || response.statusCode != 200 || !self.historyState()) {
                    self.E(error);
                    return;
                }
                $ = cheerio.load(body);
                itemList = $('div.serp-items div.ui-item:not(.is-top)').find('.item-extras:empty');
                for(var i = 0, il = itemList.length; i < il || i < historyLength; i++) {
                    data = {};
                    if(itemList[i] == undefined) {
                        break;
                    }
                    item = itemList[i].parent;
                    url = $(item).find('.item-content').find('a.item-title').attr('href');
                    if(!self.historyExists(url)){
                        self.historyWrite(url);
                        loc = $(item).find('.item-content').find('p.item-location span:not(.is-member)');
                        data.mileage = $(item).find('.item-content').find('p.item-meta').text();
                        data.title = $(item).find('.item-content').find('a.item-title').text();
                        data.price = $(item).find('.item-content').find('.item-info>strong').text();
                        if(!data.price || data.price == '') {
                            data.price = 'n/a';
                        }
                        if (!hasKeyword(data.title)) {
                            console.log(data.title + ' has no keywords on it.');
                            continue;
                        }
                        self.carChain(url, data);
                    }
                }
                self.outOfChain();
            });
        },
        carChain: function (url, data) {
            self = this;
            request(HOST + url, function (error, response, body) {
                var $, i, il, $i,
                    ir, num,
                    attrArr, 
                    numbers,
                    numDivs;
                if (error || response.statusCode != 200) {
                    return self.E(err);
                }
                $ = cheerio.load(body);
                attrArr = $('.item-properties dl');
                for (i = 0, il = attrArr.length; i < il; i++) {
                    $i = $(attrArr[i]);
                    switch($i.find('dt').text()) {
                        case ('Location:'):  data.location = $i.find('dd').text(); break;
                        case ('Brand:'):  data.brand = $i.find('dd').text(); break;
                        case ('Model:'):  data.model = $i.find('dd').text(); break;
                        case ('Model year:'):  data.modelYear = $i.find('dd').text(); break;
                        case ('Engine capacity:'):  data.engineCapacity = $i.find('dd').text(); break;
                        case ('Mileage:'):  data.mileage = $i.find('dd').text(); break;
                        default: 
                            data[$i.find('dt').text().replace(':', '').toLowerCase()] = $i.find('dd').text();
                            break;
                    }
                }
                numbers = [];
                numDivs = $('.item-contact-more.is-showable>ul li');
                for (ir in numDivs) {
                    num = numDivs[ir];
                    if (num.type == 'tag') {
                        numbers.push($(numDivs[i]).text());
                    }
                }
                data.numbers = numbers;
                data.url = HOST + url;
                textHim(data, function(NU, data){
                    _('Out of price');
                });
            });
        },
        outOfChain: callback,
        E: function (message) {
            if(message && message!=null && message!=undefined) {
                _(message);
                this.outOfChain();
                return true;
            }
            return false;
        }
    }).init();
}

function textHim(data, next) {
    if(isWithinPriceRange(data)) {
        var textStr = '', 
            params, 
            numbersMapping;

        delete data.brand;
        delete data.model;

        for(key in data) {
            textStr += data[key] + '\r\n';
        }
        params = {
            'src': 'EyeOfSauron',
            'dst' : 0,
            'text' : textStr,
            'type' : "sms",
        };
        numbersMapping = function (numbers, i) {
            if(i == undefined) {
                i = 0;
            }
            if (numbers[i]== undefined) {
                return 0;
            }
            params.dst = numbers[i];
            api.send_message(params, function (status, response) {
                console.log(textStr);
                console.log("Texted " + number);
                console.log(status, response);
                console.log("-------------------------");
                numbersMapping (numbers, i+1);
            });
        };
        numbersMapping(numbers);
    } else {
        next();
    }
}

function isWithinPriceRange(data) {
    var price = data.price;
    var model = data.model.toLowerCase();
    var modelYear = data.modelYear;
    var priceIsNa = false;

    if(price == 'n/a' || price == 'Negotiable price' || price == 'Negotiable') {
        priceIsNa = true;
    } else {
        price = price.replace(',', '').replace(',', '').replace(',', '').replace('Rs', '').replace('.').trim();
        price = parseFloat(price);
        price = price / 10000;
    }
    for( var key in priceChart) {
        if( model.indexOf(key) >= 0) {
            if ((parseFloat(priceChart[key][modelYear]) >= parseFloat(price)) || priceIsNa ) {
                return true;
            }
        }
    }
    return false;
}

function hasKeyword(title) {
    if(!keywords[0]) return true;
    if(title) {
        for (var iq in keywords) {
            var keyword = keywords[iq].toLowerCase();
            var title1 = title.toLowerCase();
            if (title1.indexOf(keyword) != -1){
                console.log(title1);
                return true;
            }
        }
        return false;
    }
    return false;
}

function start() {
    console.log('Starting script...');
    console.log('Script started.');
    var state = true;
    jf.readFile(file, function(err, json) {
        keywords = json.keywords;
        numbers = json.numbers;
        priceChart = json.pricechart;
    });

    setInterval(function() {
        if (state) {
            state = false;
            console.log('cicle start');
            getData( function() {
                console.log('cicle end');
                state = true;
                return;
            });
        }
    }, 5000);
}

start();

process.on('uncaughtException', function (err) {
    console.error(err.message);
    console.log("Exception caught. Not exiting process..");
});

//please make sure the brand is always smallcase
