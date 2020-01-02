import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Config } from "./config";

export class ApiMiddleWare {
    constructor(options?: any) {

    }

    auth(req: Request, res: Response, next: any) {
      const token = req.get('Authorization');

      if(req.path === '/api/Accounts/wechatLogin' || req.path === '/api/Accounts/login'
        || req.path === '/api/Accounts/signup' || req.path === '/api/Accounts/logout'
        || req.path === '/api/Accounts/sendVerifyMsg'
        || (req.method === 'GET' && req.path.indexOf('/api/Accounts/') !== -1)
        || req.path.indexOf('/api/Locations/Places/') !== -1
        || req.path.indexOf('/api/Locations/Geocodes/') !== -1
        || req.path === '/api/Contacts/verifyCode' || req.path === '/api/Contacts/sendVerifyMsg'
        || req.path === '/api/Restaurants' || req.path === '/api/Restaurants/qFind' || req.path === '/api/Restaurants/load'
        || req.path === '/api/Products' || req.path === '/api/Products/qFind'
        || req.path === '/api/Ranges/inRange'
        || req.path === '/api/ClientPayments/snappayNotify'
        || req.path.includes('.jpeg') || req.path.includes('.jpg') || req.path.includes('.png')){
        next();
      }else{
        const cfg = new Config();
        if (token) {
          try {
            const accountId = jwt.verify(token, cfg.JWT.SECRET);
            // TODO: compare redis token
            if(accountId){
              next();
            }else{
              return res.status(401).send("Authorization: bad token");
            }
          } catch (err) {
            return res.status(401).send("Authorization: bad token err=" + err);
          }
            
        } else {
            return res.status(401).send("API Authorization token is required.");
        }
      }
    }
}
