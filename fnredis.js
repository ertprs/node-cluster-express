"use strict";
export default class RedisFn {
    constructor(client) {
        this.client = client;
    }
    async set(obj, data, variable) {
        variable = variable.toString();
        obj = obj.toString();
        let json =  JSON.parse(await this.client.get(variable));
        if(json){
            json[obj] = data;
        }else{
            json = {}
            json[obj] = data;
        }
        json = JSON.stringify(json);
        this.client.set(variable, `${json}`);
    }
    async del(obj, variable) {
        variable = variable.toString();
        obj = obj.toString();
        let json = JSON.parse(await this.client.get(variable));
        if(json){
            delete json[obj];
            json = JSON.stringify(json);
            this.client.set(variable, `${json}`);
        }
    }
    get(variable){
        variable = variable.toString();
        return new Promise((res, rej) => {
            this.client.get(variable, function (err, value) {
                if (err) {
                    rej(err);
                } else {
                    if(value){
                        res(value)
                    }else{
                        res("{}")
                    }
                }
            })
        });
    }
}