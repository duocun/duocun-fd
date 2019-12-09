import { DB } from "../db";
import { Model } from "./model";
import { Request, Response } from "express";
import { Entity } from "../entity";
import { Config } from "../config";
import { IncomingMessage } from "http";
import https from 'https';
// import NodeRSA from 'node-rsa';
import { Md5 } from 'ts-md5';
import moment, { now } from 'moment';
import { Order, OrderType } from "../models/order";
import { ClientBalance } from "./client-balance";
import { Transaction } from "./transaction";
import { Restaurant } from "./restaurant";
import { ClientCredit } from "./client-credit";
import { CellApplication, CellApplicationStatus } from "./cell-application";

var fs = require('fs');
var util = require('util');
// var log_file = fs.createWriteStream('~/duocun-debug.log', {flags : 'w'}); // __dirname + 
var log_stdout = process.stdout;

console.log = function (d: any) { // 
  // log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

export class ClientPayment extends Model {
  cfg: Config;
  balanceEntity: ClientBalance;
  orderEntity: Order;
  transactionModel: Transaction;
  merchantModel: Restaurant;
  clientCreditModel: ClientCredit;
  cellApplicationModel: CellApplication;

  constructor(dbo: DB) {
    super(dbo, 'client_payments');

    this.orderEntity = new Order(dbo);
    this.balanceEntity = new ClientBalance(dbo);
    this.merchantModel = new Restaurant(dbo);
    this.transactionModel = new Transaction(dbo);
    this.clientCreditModel = new ClientCredit(dbo);
    this.cellApplicationModel = new CellApplication(dbo);
    this.cfg = new Config();
  }

  // abandon fix me !!
  // createAndUpdateBalance(req: Request, res: Response) {
  //   if (req.body instanceof Array) {
  //     this.insertMany(req.body).then((x: any) => {
  //       this.updateBalance(req, res);
  //     });
  //   } else {
  //     this.insertOne(req.body).then((x: any) => {
  //       this.updateBalance(req, res);
  //     });
  //   }
  // }

  // abandon fix me !!
  // updateBalance(req: Request, res: Response) {
  //   const self = this;
  //   const date = new Date('2019-05-15T00:00:00').toISOString();
  //   let balance = 0;

  //   const payment = req.body;
  //   const clientId = payment.clientId;

  //   self.orderEntity.find({ clientId: clientId, delivered: { $gt: date } }).then(os => {
  //     os.map((order: any) => {
  //       balance -= order.total;
  //     });

  //     self.find({ clientId: clientId, created: { $gt: date } }).then(ps => {
  //       ps.map((p: any) => {
  //         if (p.type === 'credit' && p.amount > 0) {
  //           balance += p.amount;
  //         }
  //       });

  //       self.balanceEntity.find({ accountId: clientId }).then((x: any) => {
  //         if (x && x.length > 0) {
  //           self.balanceEntity.updateOne({ accountId: clientId }, { amount: balance }).then(() => {

  //             res.setHeader('Content-Type', 'application/json');
  //             res.end(JSON.stringify(x, null, 3));
  //           });
  //         } else {
  //           self.balanceEntity.insertOne({
  //             accountId: payment.clientId,
  //             accountName: payment.clientName,
  //             amount: balance,
  //             created: new Date(),
  //             modified: new Date()
  //           }).then(() => {

  //             res.setHeader('Content-Type', 'application/json');
  //             res.end(JSON.stringify(x, null, 3));
  //           });
  //         }
  //       });
  //     });
  //   });
  // }

  createStripeSession(req: Request, res: Response) {
    // Set your secret key: remember to change this to your live secret key in production
    // See your keys here: https://dashboard.stripe.com/account/apikeys
    const stripe = require('stripe')(this.cfg.STRIPE.API_KEY);
    stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        name: 'T-shirt',
        description: 'Comfortable cotton t-shirt',
        images: ['https://example.com/t-shirt.png'],
        amount: 600, // cents
        currency: 'cad',
        quantity: 1,
      }],
      success_url: 'https://duocun.com.cn/payment/success',
      cancel_url: 'https://example.com.cn/payment/cancel',
    }).then((session: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(session.id, null, 3));
    });
  }

  stripeCreateCustomer(req: Request, res: Response) {
    const stripe = require('stripe')(this.cfg.STRIPE.API_KEY);
    stripe.customers.create({
      source: req.body.source,
      name: req.body.clientName,
      phone: req.body.clientPhoneNumber,
      metadata: { clientId: req.body.clientId },
    }, function (err: any, ret: any) {
      res.setHeader('Content-Type', 'application/json');
      if (err) {
        res.end(JSON.stringify({ customerId: ret.id }, null, 3));
      } else {
        res.end(JSON.stringify({ customerId: ret.id }, null, 3));
      }
    });
  }

  stripeAddCredit(req: Request, res: Response) {
    const self = this;
    const stripe = require('stripe')(this.cfg.STRIPE.API_KEY);
    const token = req.body.token;
    const accountId = req.body.accountId;
    const accountName = req.body.accountName;
    const paid = +req.body.paid;
    const note = req.body.note;

    stripe.charges.create({
      // customer: req.body.customerId,
      amount: Math.round((paid) * 100),
      currency: 'cad',
      description: 'client add credit by card',
      source: token.id,
      metadata: { customerId: accountId, customerName: accountName },
    }, function (err: any, charge: any) {
      res.setHeader('Content-Type', 'application/json');
      if (!err) {
        self.transactionModel.doAddCredit(accountId, accountName, paid, 'card', note).then(x => {
          res.end(JSON.stringify({ status: 'succeeded', chargeId: charge.id, err: err }, null, 3));
        }, err => {
          res.end(JSON.stringify({ status: 'failed', chargeId: '', err: err }, null, 3));
        });
      } else {
        res.end(JSON.stringify({ status: 'failed', chargeId: '', err: err }, null, 3));
      }
    });
  }

  stripePayOrder(req: Request, res: Response) {
    const stripe = require('stripe')(this.cfg.STRIPE.API_KEY);
    const token = req.body.token;
    const orderId = req.body.orderId;
    const paid = +req.body.paid;
    const self = this;
    self.orderEntity.findOne({ _id: orderId }).then(order => {
      const clientId = order.clientId.toString();
      const metadata = { orderId: orderId, customerId: clientId, customerName: order.clientName, merchantName: order.merchantName };
      stripe.charges.create({
        // customer: req.body.customerId,
        amount: Math.round((paid) * 100),
        currency: 'cad',
        description: order.merchantName,
        source: token.id,
        metadata: metadata
      }, function (err: any, charge: any) {
        res.setHeader('Content-Type', 'application/json');
        if (!err) {
          // update order and insert transactions
          self.orderEntity.doProcessPayment(order, 'pay by card', paid, charge.id).then(() => {
            res.end(JSON.stringify({ status: 'succeeded', chargeId: charge.id, err: err }, null, 3));
          }, err => {
            res.end(JSON.stringify({ status: 'failed', chargeId: '', err: err }, null, 3));
          });
        } else {
          res.end(JSON.stringify({ status: 'failed', chargeId: '', err: err }, null, 3));
        }
      });
    });
  }

  createLinkstring(data: any) {
    let s = '';
    Object.keys(data).map(k => {
      s += (k + '=' + data[k] + '&');
    });
    return s.substring(0, s.length - 1);
  }

  // This request could response multiple times !!!
  snappayNotify(req: Request, res: Response) {
    const b = req.body;
    // console.log('snappayNotify trans_status:' + b.trans_status);
    // console.log('snappayNotify trans_no:' + b.trans_no);
    // console.log('snappayNotify out_order_no' + b.out_order_no);
    // console.log('snappayNotify customer_paid_amount' + b.customer_paid_amount);
    // console.log('snappayNotify trans_amount' + b.trans_amount);

    this.orderEntity.find({ _id: b.out_order_no }).then(orders => {
      if (orders && orders.length > 0) {
        const order = orders[0];
        if (order.status === 'tmp') {
          const paid = +b.trans_amount;
          // --------------------------------------------------------------------------------------
          // 1.update order status to 'paid'
          // 2.add two transactions for place order and add another transaction for deposit to bank
          // 3.update account balance
          this.orderEntity.doProcessPayment(order, 'pay by wechat', paid, '').then(() => {
            // res.send(ret);
            const q = { accountId: order.clientId.toString(), status: CellApplicationStatus.NEW };
            const d = { status: CellApplicationStatus.SETUP_PAID };
            this.cellApplicationModel.findOne(q).then((ca: any) => {
              if(ca){
                this.cellApplicationModel.updateOne(q, d).then(() => {

                });
              }
            });
          }, err => {
            // res.send(ret);
          });
        }
      } else { // not a order means this is adding credit
        this.clientCreditModel.find({ _id: b.out_order_no }).then(ccs => {
          if (ccs && ccs.length > 0) {
            const cc = ccs[0];
            if (cc.status === 'new') {
              this.clientCreditModel.updateOne({ _id: cc._id }, { status: 'added' }).then(() => {
                this.transactionModel.doAddCredit(cc.accountId.toString(), cc.accountName, cc.total, cc.paymentMethod, cc.note).then(() => {

                });
              });
            }
          }
        });
      }
    });
  }

  snappayAddCredit(req: Request, res: Response) {
    const paid = +req.body.paid;
    const account = req.body.account;
    const paymentMethod = req.body.paymentMethod;
    const note = req.body.note;

    const cc = {
      accountId: account._id,
      accountName: account.username,
      total: Math.round(paid * 100) / 100,
      paymentMethod: paymentMethod,
      note: note,
      status: 'new'
    }

    this.clientCreditModel.insertOne(cc).then((c) => {
      const returnUrl = 'https://duocun.com.cn?clientId=' + account._id.toString() + '&paymentMethod=' + paymentMethod + '&page=account_settings';
      this.snappayPayReq(res, returnUrl, c._id.toString(), paymentMethod, paid, 'add credit');
    });
  }

  snappayPayOrder(req: Request, res: Response) {
    const paid = req.body.paid;
    const order = req.body.order;
    const clientId = order.clientId;
    const paymentMethod = order.paymentMethod;
    let returnUrl = 'https://duocun.com.cn?clientId=' + clientId + '&paymentMethod=' + paymentMethod + '&page=order_history';
    
    if(+order.type === OrderType.TELECOMMUNICATIONS){
      returnUrl = 'https://duocun.com.cn/cell?clientId=' + clientId + '&paymentMethod=' + paymentMethod + '&page=application_form';
    }
    
    this.snappayPayReq(res, returnUrl, order._id, paymentMethod, paid, order.merchantName);
  }

  snappaySignParams(data: any) {
    const sParams = this.createLinkstring(data);
    const encrypted = Md5.hashStr(sParams + this.cfg.SNAPPAY.MD5_KEY);
    data['sign'] = encrypted;
    data['sign_type'] = 'MD5';
    return data;
  }

  snappayPayReq(res: Response, returnUrl: string, orderId: string, paymentMethod: string, paid: number, description: string) {
    const data: any = { // the order matters
      app_id: this.cfg.SNAPPAY.APP_ID,           // Madatory
      charset: 'UTF-8',                          // Madatory
      description: description,           // Service Mandatory
      format: 'JSON',                            // Madatory
      merchant_no: this.cfg.SNAPPAY.MERCHANT_ID, // Service Mandatory
      method: 'pay.h5pay', // pc+wechat: 'pay.qrcodepay', // PC+Ali: 'pay.webpay' qq browser+Wechat: pay.h5pay,
      notify_url: 'https://duocun.com.cn/api/ClientPayments/snappayNotify',
      out_order_no: orderId,                   // Service Mandatory
      payment_method: paymentMethod,       // WECHATPAY, ALIPAY, UNIONPAY
      return_url: returnUrl,
      trans_amount: paid,                        // Service Mandatory
      version: '1.0'                             // Madatory
    };

    const params = this.snappaySignParams(data);
    const options = {
      hostname: 'open.snappay.ca',
      port: 443,
      path: '/api/gateway',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Content-Length': Buffer.byteLength(data)
      }
    };
    const post_req = https.request(options, (res1: IncomingMessage) => {
      let ss = '';
      res1.on('data', (d) => { ss += d; });
      res1.on('end', (r: any) => {
        if (ss) { // code, data, msg, total, psn, sign
          const ret = JSON.parse(ss); // s.data = {out_order_no:x, merchant_no:x, trans_status:x, h5pay_url}
          if (ret.msg === 'success') {
            res.send(ret);
          } else {
            res.send(ret);
          }
        } else {
          res.send({ msg: 'failed' });
        }
      });
    });

    post_req.write(JSON.stringify(params));
    post_req.end();
  }

  // deprecated
  snappayQueryOrderReq(out_order_no: string) {
    const merchant_no = this.cfg.SNAPPAY.MERCHANT_ID;
    const data: any = { // the order matters
      app_id: this.cfg.SNAPPAY.APP_ID,  // Mandatory
      charset: 'UTF-8',                 // Mandatory
      format: 'JSON',                   // Mandatory
      merchant_no: merchant_no,         // Service Mandatory
      method: 'pay.orderquery',         // Service Mandatory
      out_order_no: out_order_no,       // Service Optional
      version: '1.0'                    // Mandatory
    };

    const params = this.snappaySignParams(data);
    const options = {
      hostname: 'open.snappay.ca',
      port: 443,
      path: '/api/gateway',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Content-Length': Buffer.byteLength(data)
      }
    };

    return new Promise((resolve, reject) => {
      const post_req = https.request(options, (res1: IncomingMessage) => {
        let ss = '';
        res1.on('data', (d) => { ss += d; });
        res1.on('end', (r: any) => {
          if (ss) { // code, data, msg, total, psn, sign
            const ret = JSON.parse(ss); // s.data = {trans_no:x, out_order_no:x, merchant_no:x, trans_status:x }
            if (ret.msg === 'success') {
              resolve(ret);
              console.log(ss);
            } else {
              resolve(ret);
            }
          } else {
            resolve({ msg: 'failed' });
          }
        });
      });

      post_req.write(JSON.stringify(params));
      post_req.end();
    });
  }

  // deprecated
  stripeRefund(req: Request, res: Response) {
    const stripe = require('stripe')(this.cfg.STRIPE.API_KEY);
    const chargeId = req.body.chargeId;
    stripe.refunds.create({ charge: chargeId }, function (err: any, re: any) {
      res.setHeader('Content-Type', 'application/json');
      if (err) {
        res.end(JSON.stringify({ status: err.code, refundId: '' }, null, 3));
      } else {
        res.end(JSON.stringify({ status: re.status, refundId: re.id }, null, 3));
      }
    });
  }

  // deprecated
  addGroupDiscount(clientId: string, merchantId: string, dateType: string, address: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const date = dateType === 'today' ? moment() : moment().add(1, 'day');
      const range = { $gte: date.startOf('day').toISOString(), $lte: date.endOf('day').toISOString() };
      const q = { delivered: range, address: address, status: { $nin: ['bad', 'del', 'tmp'] } };
      this.orderEntity.find(q).then((orders: any[]) => {
        this.orderEntity.addGroupDiscounts(clientId, orders).then((x: any) => {
          this.balanceEntity.addGroupDiscounts(orders).then((x1: any) => {
            resolve(x);
          });
        });
      });
    });
  }

  // deprecated
  removeGroupDiscount(date: string, address: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const q = { delivered: date, address: address, status: { $nin: ['bad', 'del', 'tmp'] } }
      this.orderEntity.find(q).then((orders: any[]) => {
        this.orderEntity.removeGroupDiscounts(orders).then((orderUpdates: any[]) => {
          this.balanceEntity.removeGroupDiscounts(orders).then((balanceUpdates: any[]) => {
            resolve(orders);
          });
        });
      });
    });
  }

  // deprecated
  reqAddGroupDiscount(req: Request, res: Response) {
    const clientId = req.body.clientId;
    const merchantId = req.body.merchantId;
    const dateType = req.body.dateType;
    const address = req.body.address;

    this.addGroupDiscount(clientId, merchantId, dateType, address).then((xs: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'success' }, null, 3));
    });
  }

  // deprecated
  reqRemoveGroupDiscount(req: Request, res: Response) {
    const delivered = req.body.delivered;
    const address = req.body.address;

    this.removeGroupDiscount(delivered, address).then((xs: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'success' }, null, 3));
    });
  }
}