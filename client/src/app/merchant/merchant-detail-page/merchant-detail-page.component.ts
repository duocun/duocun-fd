import { Component, OnInit, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '../../../../node_modules/@angular/router';
import { Subject } from '../../../../node_modules/rxjs';
import { takeUntil } from '../../../../node_modules/rxjs/operators';

import { MerchantService } from '../merchant.service';
import { IRestaurant } from '../../restaurant/restaurant.model';
import { ProductService } from '../../product/product.service';
import { IProduct, ICategory } from '../../product/product.model';
import { CategoryService } from '../../category/category.service';
import { NgRedux } from '../../../../node_modules/@angular-redux/store';
import { ICart, ICartItem } from '../../cart/cart.model';
import { PageActions } from '../../main/main.actions';
import { MatDialog } from '../../../../node_modules/@angular/material';
import { QuitRestaurantDialogComponent } from '../quit-restaurant-dialog/quit-restaurant-dialog.component';


@Component({
  selector: 'app-merchant-detail-page',
  templateUrl: './merchant-detail-page.component.html',
  styleUrls: ['./merchant-detail-page.component.scss']
})
export class MerchantDetailPageComponent implements OnInit, OnDestroy {

  categories;
  groups;
  restaurant: IRestaurant;
  subscription;
  // cart: ICart;
  onDestroy$ = new Subject<any>();
  locationSubscription;
  dow: number; // day of week
  // delivery: IDelivery;
  products;
  cart;

  constructor(
    private productSvc: ProductService,
    private categorySvc: CategoryService,
    private merchantSvc: MerchantService,
    private route: ActivatedRoute,
    private rx: NgRedux<ICart>,
    private location: Location,
    // private rangeSvc: RangeService,
    public dialog: MatDialog
  ) {
    const self = this;

    // show cart on footer
    this.rx.dispatch({type: PageActions.UPDATE_URL, payload: 'restaurant-detail'});

    this.categorySvc.find().pipe(takeUntil(this.onDestroy$)).subscribe(categories => {
      self.categories = categories;
    });

    this.rx.select<ICart>('cart').pipe(takeUntil(this.onDestroy$)).subscribe((cart: ICart) => {
      this.cart = cart;
      if (self.products && self.categories) {
        self.groups = self.groupByCategory(this.products, this.categories);

        // update quantity of cart items
        self.groups.map(group => {
          group.items.map(groupItem => {
            const cartItem: ICartItem = cart.items.find(item => item.productId === groupItem.product.id);
            groupItem.quantity = cartItem ? cartItem.quantity : 0;
          });
        });
      }
    });

    this.locationSubscription = this.location.subscribe((x) => {
      if (window.location.pathname.endsWith('main/home') ||
        window.location.pathname.endsWith('/') ||
        window.location.pathname.endsWith('contact/address-form')
      ) {
        // window.history.forward();
        if (self.restaurant && self.cart && self.cart.items && self.cart.items.length > 0) {
          this.openDialog(self.restaurant.id, 'restaurant-list');
        }
      } else if (window.location.pathname.endsWith('order/history')) {
        if (self.restaurant && self.cart && self.cart.items && self.cart.items.length > 0) {
          this.openDialog(self.restaurant.id, 'order-history');
        }
      }
    });

  }

  ngOnInit() {
    const self = this;
    self.route.params.pipe(takeUntil(this.onDestroy$)).subscribe(params => {
      const merchantId = params['id'];
      self.merchantSvc.findById(merchantId).pipe(takeUntil(this.onDestroy$)).subscribe((restaurant: IRestaurant) => {
        self.restaurant = restaurant;
        // self.rangeSvc.find().pipe(takeUntil(self.onDestroy$)).subscribe(ranges => {
        //   const origin = self.delivery.origin;
        //   if (origin) {
        //     const rs = self.rangeSvc.getAvailableRanges({ lat: origin.lat, lng: origin.lng }, ranges);
        //     restaurant.inRange = (rs && rs.length > 0) ? true : false;

        //     restaurant.fullDeliveryFee = self.cart.deliveryCost;
        //     restaurant.deliveryFee = self.cart.deliveryFee;
        //     restaurant.deliveryDiscount = self.cart.deliveryDiscount;
        //   }
        //   self.restaurant = restaurant;
        // });
      });

      // if (self.delivery && self.delivery.fromTime) {
      //   self.dow = moment(self.delivery.fromTime).day(); // 0 for sunday
      // }

      const q = { merchantId: merchantId }; // , dow: { $in: [self.dow.toString(), 'all'] } };
      self.productSvc.find(q).pipe(takeUntil(self.onDestroy$)).subscribe(products => {
        self.products = products;
        self.groups = self.groupByCategory(products, this.categories);

        // update quantity of cart items
        self.groups.map(group => {
          group.items.map(groupItem => {
            const cartItem: ICartItem = this.cart.items.find(item => item.productId === groupItem.product.id);
            groupItem.quantity = cartItem ? cartItem.quantity : 0;
          });
        });
      });
    });
  }

  ngOnDestroy() {
    this.locationSubscription.unsubscribe();
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  openDialog(merchantId: string, fromPage: string): void {
    const dialogRef = this.dialog.open(QuitRestaurantDialogComponent, {
      width: '300px',
      data: {
        title: '提示', content: '离开后将清空购物车。', buttonTextNo: '离开', buttonTextYes: '留下',
        merchantId: merchantId, fromPage: fromPage
      },
    });

    dialogRef.afterClosed().pipe(takeUntil(this.onDestroy$)).subscribe(result => {

    });
  }

  onAfterCheckout(e) {

  }

  groupByCategory(products: IProduct[], categories: ICategory[]) {
    const cats = [];

    products.map(p => {
      const cat = cats.find(c => c.categoryId === p.categoryId);
      const category = categories.find(c => c.id === p.categoryId);
      if (cat) {
        cat.items.push({ product: p, quanlity: 0 });
      } else {
        if (category) {
          cats.push({ categoryId: p.categoryId, categoryName: p.category.name, order: category.order,
            items: [{ product: p, quanlity: 0 }]
          });
        } else {
          cats.push({ categoryId: p.categoryId, categoryName: p.category.name, order: 0,
            items: [{ product: p, quanlity: 0 }]
          });
        }
      }
    });

    cats.map(c => {
      c.items.sort((a, b) => {
        if (a.product.order < b.product.order) {
          return -1;
        } else {
          return 1;
        }
      });
    });

    return cats.sort((a, b) => {
      if (a.order < b.order) {
        return -1;
      } else {
        return 1;
      }
    });
  }
}
