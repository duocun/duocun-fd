import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '../../../../node_modules/@angular/router';
import { TransactionService } from '../../transaction/transaction.service';
import { OrderService } from '../../order/order.service';
import { ITransaction } from '../../transaction/transaction.model';
import { MatSnackBar } from '../../../../node_modules/@angular/material';
import { takeUntil } from '../../../../node_modules/rxjs/operators';
import { Subject } from '../../../../node_modules/rxjs';
import { environment } from '../../../environments/environment';
import { ICartItem, ICart } from '../../cart/cart.model';
import { IOrder } from '../../order/order.model';
import { AccountService } from '../../account/account.service';
import { NgRedux } from '../../../../node_modules/@angular-redux/store';
import { IAppState } from '../../store';
import { CartActions } from '../../cart/cart.actions';
import { AccountActions } from '../../account/account.actions';
import { PaymentService } from '../payment.service';
import { OrderActions } from '../../order/order.actions';

const DEFAULT_ADMIN = environment.DEFAULT_ADMIN;

@Component({
  selector: 'app-pay-complete',
  templateUrl: './pay-complete.component.html',
  styleUrls: ['./pay-complete.component.scss']
})
export class PayCompleteComponent implements OnInit, OnDestroy {
  private onDestroy$ = new Subject<any>();
  cart;

  constructor(private route: ActivatedRoute,
    private accountSvc: AccountService,
    private transactionSvc: TransactionService,
    private orderSvc: OrderService,
    private paymentSvc: PaymentService,
    private router: Router,
    private rx: NgRedux<IAppState>,
    private snackBar: MatSnackBar
  ) {
    const self = this;
    this.route.queryParams.subscribe(params => {
      const p = params;
      // {msg: 'success', orderId: '5db1a1d3467deb1b72cb053f', clientId: '5cad44629687ac4a075e2f42',
      // amount: 10, paymentMethod: 'WECHATPAY'};
      if (p && p.msg === 'success') {
        self.snackBar.open('', '已成功付款', { duration: 1800 });
        if (p && p.orderId && p.clientId) {
          this.accountSvc.find({ _id: p.clientId }).pipe(takeUntil(self.onDestroy$)).subscribe(accounts => {
            self.rx.dispatch({ type: AccountActions.UPDATE, payload: accounts[0] });
            this.afterSnappay(p.orderId, p.clientId, accounts[0].username, +p.amount, p.paymentMethod);
          });
        }
      } else if (p && p.msg === 'fail') {
        //   // this.orderSvc.removeById(p.orderId).pipe(takeUntil(this.onDestroy$)).subscribe(x => {
        //   //   self.snackBar.open('', '付款未成功', { duration: 1800 });
        //   //   self.router.navigate(['order/history']);
        //   //   alert('付款未成功，请联系客服');
        //   // });
        alert('付款未成功，请联系客服');
      }
    });


    this.rx.select<ICart>('cart').pipe(takeUntil(this.onDestroy$)).subscribe((cart: ICart) => {
      this.cart = cart;
    });
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  afterSnappay(orderId, clientId, clientName, paid, paymentMethod) {
    const self = this;
    self.saveTransaction(clientId, clientName, paid, paymentMethod, (tr: ITransaction) => {
      const data = { status: 'paid', chargeId: '', transactionId: tr.id };
      self.orderSvc.update({ _id: orderId }, data).pipe(takeUntil(this.onDestroy$)).subscribe((r) => {

        self.snackBar.open('', '您的订单已经成功修改。', { duration: 2000 });
        self.orderSvc.quickFind({ _id: orderId }).pipe(takeUntil(self.onDestroy$)).subscribe(orders => {
          const order = orders[0];
          const delivered = order.delivered;
          const address = order.address;
          // update my balance and group discount
          self.paymentSvc.afterAddOrder(clientId, delivered, address, paid).pipe(takeUntil(self.onDestroy$)).subscribe((r1: any) => {
            self.snackBar.open('', '余额已更新', { duration: 1800 });
            const items: ICartItem[] = self.cart.items.filter(x => x.merchantId === order.merchantId);
            self.rx.dispatch({ type: CartActions.REMOVE_FROM_CART, payload: { items: items } });
            self.rx.dispatch({ type: OrderActions.CLEAR, payload: {} });
            self.router.navigate(['order/history']);
          });
        });
      }, err => {
        self.snackBar.open('', '您的订单未更改成功，请重新更改。', { duration: 1800 });
      });
    });
  }

  saveTransaction(clientId: string, clientName: string, amount: number, paymentMethod: string, cb?: any) {
    const tr: ITransaction = {
      fromId: clientId,
      fromName: clientName,
      toId: DEFAULT_ADMIN.ID,
      toName: DEFAULT_ADMIN.NAME,
      type: 'credit',
      amount: amount,
      note: paymentMethod,
      created: new Date(),
      modified: new Date()
    };
    this.transactionSvc.save(tr).pipe(takeUntil(this.onDestroy$)).subscribe(t => {
      this.snackBar.open('', '已保存交易', { duration: 1200 });
      if (cb) {
        cb(t);
      }
    });
  }

  updateOrder(orderId: string, updated: any, updateCb?: any) {
    const self = this;
    self.orderSvc.update({ _id: orderId }, updated).pipe(takeUntil(this.onDestroy$)).subscribe((r: IOrder) => {

      self.snackBar.open('', '您的订单已经成功修改。', { duration: 2000 });
      if (updateCb) {
        updateCb(r);
      }
    }, err => {
      self.snackBar.open('', '您的订单未更改成功，请重新更改。', { duration: 1800 });
    });
  }
}
