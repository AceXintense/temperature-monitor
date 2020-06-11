const express = require('express');
const app = express();
const fs = require('fs');
const listenPort = 9101;

const basePath = '/sys/bus/w1/devices/';
const prefix = 'server_cabinet_';
const identifer = '28-';

function getSensors() {
    let sensors = [];
    let files = fs.readdirSync(basePath);
    let mapping = JSON.parse(fs.readFileSync('./mapping.json', { "encoding": 'UTF-8' }));

    files.map(file => {
        if (file.indexOf('w1_bus_master') < 0) {
            if (file.indexOf(identifer) >= 0) {
                if (mapping[file]) {
                    sensors.push({
                        identifier: file,
                        name: mapping[file]
                    });
                } else {
                    sensors.push({
                        identifier: file,
                        name: file
                    });
                }
            }
        }
    });

    return sensors;
}

function getFileContents(path) {
    return fs.readFileSync(path, {
        encoding: 'UTF-8'
    });
}

function calculateCelsius(rawTemperature) {
    return parseFloat(rawTemperature) / 1000.0;
}

function calculateFahrenheit(rawTemperature) {
    let celsius = calculateCelsius(rawTemperature);
    return celsius * 9.0 / 5.0 + 32.0;
}

function getTemperature(sensor) {
    let fileContent = getFileContents(basePath + sensor + '/w1_slave');

    // Check to see if YES is present if not check again until it does
    while (fileContent.indexOf('YES') < 0) {
        fileContent = getFileContents(basePath + sensor + '/w1_slave');
    }

    let matches = /(?:t\=)(.*)/gm.exec(fileContent);
    let rawTemperature = matches[1];

    return {
        celsius: calculateCelsius(rawTemperature),
        fahrenheit: calculateFahrenheit(rawTemperature)
    };
}

app.get('/temperatures', (request, response) => {
    let temperatures = [];
    let sensors = getSensors();
    sensors.map(sensor => {
        temperatures.push({
            sensor: sensor,
            temperature: getTemperature(sensor.identifier)
        });
    });

    response.send(temperatures);
});

app.get('/sensors', (request, response) => {
    response.send(getSensors());
});

app.get('/metrics', (request, response) => {
    let jsonOutput = '';
    let strings = [];
    let sensors = getSensors();
    sensors.map(sensor => {
        let item = {};
        let temperature = getTemperature(sensor.identifier);

        item[sensor.name + '_c'] = temperature.celsius;
        strings.push(item);

        item = {};
        item[sensor.name + '_f'] = temperature.fahrenheit;
        strings.push(item);
    });

    strings.map((object) => {
        jsonOutput += prefix + Object.keys(object)[0] + ' ' + Object.values(object)[0] + '\n';
    });

    response.send(jsonOutput);
});

app.listen(listenPort, (err) => {
    if (err) {
        return console.log('something bad happened', err);
    }

    console.log(`server is listening on ${listenPort}`);
});
