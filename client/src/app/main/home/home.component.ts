import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { LocationService } from '../../location/location.service';
import { AccountService } from '../../account/account.service';
import { ILocationHistory, IPlace, ILocation, ILatLng, GeoPoint } from '../../location/location.model';
import { NgRedux } from '@angular-redux/store';
import { IAppState } from '../../store';
import { PageActions } from '../../main/main.actions';
// import { SocketService } from '../../shared/socket.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../account/auth.service';
import { IPageAction } from '../main.reducers';
import { Subject } from '../../../../node_modules/rxjs';
import { takeUntil } from '../../../../node_modules/rxjs/operators';
import { ICommand } from '../../shared/command.reducers';
import { Account, IAccount } from '../../account/account.model';
import { AccountActions } from '../../account/account.actions';
import { MatSnackBar, MatTooltip } from '../../../../node_modules/@angular/material';
import { ContactService } from '../../contact/contact.service';
import { IContact, Contact } from '../../contact/contact.model';
import { CommandActions } from '../../shared/command.actions';
import { IAddressAction } from '../../location/address.reducer';
import { AddressActions } from '../../location/address.actions';
import { DeliveryActions } from '../../delivery/delivery.actions';
import { IDeliveryAction } from '../../delivery/delivery.reducer';
import { IDelivery } from '../../delivery/delivery.model';
import { ContactActions } from '../../contact/contact.actions';
import * as moment from 'moment';
import { RangeService } from '../../range/range.service';
import { IRange } from '../../range/range.model';

const WECHAT_APP_ID = environment.WECHAT.APP_ID;
const WECHAT_REDIRCT_URL = environment.WECHAT.REDIRECT_URL;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  center: GeoPoint = { lat: 43.761539, lng: -79.411079 };
  restaurants;
  places: IPlace[];
  deliveryAddress = '';
  placeholder = 'Delivery Address';
  mapFullScreen = true;
  subscrAccount;
  account: IAccount;
  bHideMap = false;
  bTimeOptions = false;
  // overdue;
  afternoon;
  contact;
  inRange = false;
  onDestroy$ = new Subject<any>();
  loading = true;
  location;
  bUpdateLocationList = true;
  bInputLocation = false;
  placeForm;
  historyAddressList = [];
  suggestAddressList = [];
  selectedDate = 'today';
  address: ILocation;

  mapRanges;
  mapZoom;
  mapCenter;

  availableRanges;
  sOrderDeadline;
  today;
  tomorrow;
  bAddressList = false;
  date;
  phase = 'today:lunch';
  bPayment = false;

  @ViewChild('tooltip', { static: true }) tooltip: MatTooltip;

  constructor(
    private accountSvc: AccountService,
    private locationSvc: LocationService,
    private authSvc: AuthService,
    private contactSvc: ContactService,
    private rangeSvc: RangeService,
    // private socketSvc: SocketService,
    private router: Router,
    private route: ActivatedRoute,
    private rx: NgRedux<IAppState>,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    const self = this;
    const today = moment().format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD');

    // For display purpose only
    this.today = { type: 'lunch today', text: '今天午餐', date: today, startTime: '11:45', endTime: '13:15' };
    this.tomorrow = { type: 'lunch tomorrow', text: '今天午餐', date: tomorrow, startTime: '11:45', endTime: '13:15' };

    this.placeForm = this.fb.group({ addr: [''] });
    this.loading = true;

    this.rx.dispatch({ type: PageActions.UPDATE_URL, payload: { name: 'home' } });

    this.rx.select('delivery').pipe(takeUntil(this.onDestroy$)).subscribe((d: IDelivery) => {
      const origin = d.origin;
      if (d && origin) {
        self.deliveryAddress = self.locationSvc.getAddrString(d.origin);
        self.placeForm.get('addr').patchValue(self.deliveryAddress);
        if (self.deliveryAddress && self.bUpdateLocationList) {
          self.getSuggestLocationList(self.deliveryAddress, false);
          self.bAddressList = false;
        }

        this.calcRange(origin);

      } else {
        this.address = null;
        this.inRange = true;
      }

      if (d && d.date) { // moment
        self.selectedDate = d.dateType;
        self.phase = (d.dateType === 'today') ? 'today:lunch' : 'tomorrow:lunch';
        self.date = d.date;
      } else {
        self.selectedDate = 'today';
        self.phase = 'today:lunch';
        self.date = moment();
        this.rx.dispatch({ type: DeliveryActions.UPDATE_DATE, payload: { date: today, dateType: self.selectedDate } });
      }
    });

    self.route.queryParamMap.pipe(takeUntil(this.onDestroy$)).subscribe(queryParams => {
      const code = queryParams.get('code');

      // process payment route ?clientId=x&paymentMethod=y
      const clientId = queryParams.get('clientId'); // use for after card pay, could be null
      const page = queryParams.get('page');
      if (page === 'account_settings') { // for wechatpay add credit procedure
        this.accountSvc.quickFind({ _id: clientId }).pipe(takeUntil(this.onDestroy$)).subscribe((accounts: IAccount[]) => {
          this.rx.dispatch({ type: AccountActions.UPDATE, payload: accounts[0] });
          self.router.navigate(['account/balance']);
        });
        return;
      } else if (page === 'order_history') { // for wechatpay procedure
        if (clientId) {
          this.bPayment = true;
          this.accountSvc.quickFind({ _id: clientId }).pipe(takeUntil(this.onDestroy$)).subscribe((accounts: IAccount[]) => {
            this.rx.dispatch({ type: AccountActions.UPDATE, payload: accounts[0] });
            self.router.navigate(['order/history']);
          });
          return;
        }
      }

      self.accountSvc.getCurrentAccount().pipe(takeUntil(this.onDestroy$)).subscribe((account: IAccount) => {
        if (account) { // if already login
          this.loading = false;
          self.account = account;
          self.init(account);
        } else {
          if (code) {
            this.loading = true;
            this.accountSvc.wechatLogin(code).pipe(takeUntil(this.onDestroy$)).subscribe((data: any) => {
              if (data) {
                self.wechatLoginHandler(data);
              } else { // failed from shared link login
                this.loading = false;

                // redirect to wechat authorize button page
                window.location.href = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + WECHAT_APP_ID
                  + '&redirect_uri=' + WECHAT_REDIRCT_URL
                  + '&response_type=code&scope=snsapi_userinfo&state=123#wechat_redirect';
              }
            });
          } else { // no code in router
            this.loading = false;
            // if (environment.language === 'en') {
            //   this.router.navigate(['account/login']);
            // }
          }
        }
      }, err => {
        this.loading = false;
        // if (environment.language === 'en') {
        //   this.router.navigate(['account/login']);
        // }
      });
    });

  }


  calcRange(origin) {
    const self = this;
    this.rangeSvc.find({ status: 'active' }).pipe(takeUntil(this.onDestroy$)).subscribe((rs: IRange[]) => {
      const ranges: IRange[] = [];
      rs.map((r: IRange) => {
        if (this.locationSvc.getDirectDistance(origin, { lat: r.lat, lng: r.lng }) < r.radius) {
          ranges.push(r);
        }
      });

      this.inRange = (ranges && ranges.length > 0) ? true : false;
      this.mapRanges = rs;

      if (this.inRange) {
        self.mapZoom = 14;
        self.mapCenter = origin;
      } else {
        self.mapZoom = 9;
        const farNorth = { lat: 44.2653618, lng: -79.4191007 };
        self.mapCenter = {
          lat: (origin.lat + farNorth.lat) / 2,
          lng: (origin.lng + farNorth.lng) / 2
        };
      }
      this.address = origin; // order matters
    });
  }


  // data : {id:'xxx', ttl: 10000, userId: 'xxxxx' }
  wechatLoginHandler(data: any) {
    const self = this;
    self.authSvc.setUserId(data.userId);
    self.authSvc.setAccessToken(data.id);
    self.accountSvc.getCurrentAccount().pipe(takeUntil(this.onDestroy$)).subscribe((account: Account) => {
      if (account) {
        self.account = account;

        this.snackBar.open('', '微信登录成功。', { duration: 1000 });
        self.loading = false;
        self.init(account);
      } else {
        this.snackBar.open('', '微信登录失败。', { duration: 1000 });
        self.loading = false;
      }
    });
  }

  updateFooterStatus(account: IAccount) {
    this.rx.dispatch({ type: CommandActions.SEND, payload: { name: 'loggedIn', args: null } }); // for updating footer
    this.rx.dispatch({ type: AccountActions.UPDATE, payload: account });
  }

  init(account: IAccount) {
    const self = this;
    const accountId = account._id;

    this.updateFooterStatus(account);
    this.locationSvc.find({ accountId: accountId }).pipe(takeUntil(this.onDestroy$)).subscribe((lhs: ILocationHistory[]) => {
      const a = this.locationSvc.toPlaces(lhs);
      self.historyAddressList = a;
    });
    // self.socketSvc.init(this.authSvc.getAccessTokenId());

    // redirect to filter if contact have default address
    self.contactSvc.find({ accountId: accountId }).pipe(takeUntil(self.onDestroy$)).subscribe((r: IContact[]) => {
      if (r && r.length > 0) {
        self.contact = new Contact(r[0]);
        self.rx.dispatch({ type: ContactActions.LOAD_FROM_DB, payload: self.contact });
        if (self.contact.location) {
          self.bUpdateLocationList = false;
          self.rx.dispatch({ type: DeliveryActions.UPDATE_ORIGIN, payload: { origin: self.contact.location } });
          self.deliveryAddress = self.locationSvc.getAddrString(self.contact.location); // set address text to input
          self.address = self.contact.location; // update merchant list
        }
      }
    });
  }

  ngOnInit() {
    this.places = []; // clear address list
    this.rx.dispatch<IPageAction>({ type: PageActions.UPDATE_URL, payload: { name: 'home' } });
    this.rx.select<ICommand>('cmd').pipe(takeUntil(this.onDestroy$)).subscribe((x: ICommand) => {
      if (x.name === 'clear-location-list') {
        this.places = [];
      }
    });
  }

  ngOnDestroy() {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  showLocationList() {
    return this.places && this.places.length > 0;
  }

  onAddressInputFocus(e?: any) {
    const account = this.account;
    this.places = [];
    this.bUpdateLocationList = true;

    if (account) {
      const accountId = account._id;
      const visited = account.visited;

      if (!visited) {
        this.account.visited = true;
        this.accountSvc.update({ _id: accountId }, { visited: true }).pipe(takeUntil(this.onDestroy$)).subscribe(r => {
          this.rx.dispatch({ type: AccountActions.UPDATE, payload: this.account });
          // console.log('update user account');
        });
      }

      if (e.input) {
        this.places = this.suggestAddressList;
      } else {
        this.places = this.historyAddressList.map(x => Object.assign({}, x));
      }
      this.bAddressList = true;
    }
  }

  onAddressInputChange(e) {
    const v = e.input;
    if (v && v.length >= 3) {
      this.rx.dispatch<IAddressAction>({
        type: AddressActions.UPDATE,
        payload: v
      });
      this.getSuggestLocationList(e.input, true);
      this.bAddressList = true;
    }
  }

  onBack() {
    // this.deliveryAddress = '';
    this.places = [];
  }

  onAddressInputClear(e) {
    this.deliveryAddress = '';
    this.places = [];
    this.bUpdateLocationList = true;
    this.rx.dispatch({
      type: DeliveryActions.UPDATE_ORIGIN,
      payload: { origin: null }
    });
    this.onAddressInputFocus({ input: '' });
  }

  getSuggestLocationList(input: string, bShowList: boolean) {
    const self = this;
    this.places = [];
    this.locationSvc.reqPlaces(input).pipe(takeUntil(this.onDestroy$)).subscribe((ps: IPlace[]) => {
      if (ps && ps.length > 0) {
        const places = [];
        ps.map(p => {
          p.type = 'suggest';
          places.push(Object.assign({}, p));
        });

        self.suggestAddressList = places;
        if (bShowList) {
          self.places = places; // without lat lng
        }
      }
    });
  }

  onSelectPlace(e) {
    const self = this;
    const r: ILocation = e.location;
    this.places = [];
    this.bUpdateLocationList = false;
    this.location = r;
    self.bAddressList = false;
    if (r) {
      this.deliveryAddress = e.address; // set address text to input
      this.rx.dispatch<IDeliveryAction>({ type: DeliveryActions.UPDATE_ORIGIN, payload: { origin: r } });

      if (self.account) {
        const accountId = self.account._id;
        const accountName = self.account.username;
        const query = { accountId: accountId, placeId: r.placeId };
        const lh = { accountId: accountId, accountName: accountName, placeId: r.placeId, location: r };

        self.locationSvc.upsertOne(query, lh).pipe(takeUntil(this.onDestroy$)).subscribe(() => {

        });
      }

      if (r) {
        self.rx.dispatch({ type: ContactActions.UPDATE_LOCATION, payload: r });
        self.bUpdateLocationList = false;
        self.rx.dispatch({ type: DeliveryActions.UPDATE_ORIGIN, payload: { origin: r } });
        self.deliveryAddress = self.locationSvc.getAddrString(r); // set address text to input
        self.address = r; // update merchant list
      }
    }
  }

  onSelectDate(e) {
    if (e.value === 'tomorrow') {
      const tomorrow = moment().set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).add(1, 'days');
      this.rx.dispatch({ type: DeliveryActions.UPDATE_DATE, payload: { date: tomorrow, dateType: 'tomorrow' } });
      this.phase = 'tomorrow:lunch';
    } else {
      const today = moment().set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
      this.rx.dispatch({ type: DeliveryActions.UPDATE_DATE, payload: { date: today, dateType: 'today' } });
      this.phase = 'today:lunch';
    }
  }

  resetAddress() {
    this.address = null;
    this.inRange = true;
    this.deliveryAddress = '';
  }

}
