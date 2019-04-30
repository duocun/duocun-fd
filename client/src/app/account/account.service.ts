import { throwError as observableThrowError, Observable } from 'rxjs';
import { map, catchError, mergeMap, flatMap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { empty, of } from 'rxjs';


import { environment } from '../../environments/environment';
import { Account } from './account.model';

import { NgRedux } from '@angular-redux/store';
import { AccountActions } from './account.actions';
import { AuthService } from './auth.service';
import { EntityService } from '../entity.service';

export interface IAccessToken {
  'id'?: string;
  'ttl'?: number;
  'created'?: Date;
  'userId'?: string;
}

const API_URL = environment.API_URL;

@Injectable()
export class AccountService extends EntityService {
  url;
  DEFAULT_PASSWORD = '123456';

  constructor(
    private ngRedux: NgRedux<Account>,
    public authSvc: AuthService,
    public http: HttpClient
  ) {
    super(authSvc, http);
    this.url = super.getBaseUrl() + 'Accounts';
  }

  signup(account: Account): Observable<any> {
    return this.http.post(this.url + '/signup', account);
  }

  // login --- return {id: tokenId, ttl: 10000, userId: r.id}
  login(username: string, password: string, rememberMe: boolean = true): Observable<any> {
    const credentials = {
      username: username,
      password: password
    };
    return this.http.post(this.url + '/login', credentials);
  }

  logout(): Observable<any> {
    const state = this.ngRedux.getState();
    if (state && state.id) {
      this.ngRedux.dispatch({ type: AccountActions.UPDATE, payload: new Account() });
    }
    return this.http.post(this.url + '/logout', {});
  }

  // ------------------------------------
  // getCurrentUser
  // return Account object or null
  getCurrentUser(): Observable<any> {
    const id: any = this.authSvc.getUserId();
    // const url = id ? (this.url + '/' + id) : (this.url + '/__anonymous__');
    if (id) {
      return this.http.get(this.url + '/' + id);
    } else {
      return of(null);
    }
  }

  getCurrent(forceGet: boolean = false): Observable<Account> {
    const self = this;
    const state: any = this.ngRedux.getState();
    if (!state || !state.account || !state.account.id || forceGet) {
      return this.getCurrentUser();
    } else {
      return this.ngRedux.select<Account>('account');
    }
  }

  find(filter?: any): Observable<any> {
    let headers: HttpHeaders = new HttpHeaders();
    headers = headers.append('Content-Type', 'application/json');
    const accessTokenId = this.authSvc.getAccessToken();
    if (accessTokenId) {
      headers = headers.append('Authorization', '' + accessTokenId);
      // httpParams = httpParams.append('access_token', LoopBackConfig.getAuthPrefix() + accessTokenId);
    }
    if (filter) {
      headers = headers.append('filter', JSON.stringify(filter));
    }
    return this.http.get(this.url, { headers: headers });
  }

  // override method
  findById(id: string, filter?: any): Observable<any> {
    let headers: HttpHeaders = new HttpHeaders();
    headers = headers.append('Content-Type', 'application/json');
    const accessTokenId = this.authSvc.getAccessToken();
    if (accessTokenId) {
      headers = headers.append('Authorization', '' + accessTokenId);
      // httpParams = httpParams.append('access_token', LoopBackConfig.getAuthPrefix() + accessTokenId);
    }
    if (filter) {
      headers = headers.append('filter', JSON.stringify(filter));
    }
    const url = id ? (this.url + '/' + id) : (this.url + '/__anonymous__');
    return this.http.get(url, { headers: headers });
  }

  create(account: Account): Observable<any> {
    return this.http.post(this.url, account);
  }

  replaceById(id: number, account: Account) {
    return this.http.put(this.url, account);
  }

  rmAccount(id): Observable<any> {
    return this.http.get(this.url);
  }

  // getWechatAccessToken(authCode: string) {
  //   const url = super.getBaseUrl() + 'wechatAccessToken?code=' + authCode;
  //   return this.http.get(url);
  // }
  // refreshWechatAccessToken(refreshToken: string) {
  //   const url = super.getBaseUrl() + 'wechatRefreshAccessToken?token=' + refreshToken;
  //   return this.http.get(url);
  // }

  wechatLogin(authCode: string) {
    const url = super.getBaseUrl() + 'wechatLogin?code=' + authCode;
    return this.http.get(url);
  }

  // getUserList(query?: string): Observable<User[]> {
  //     const url = API_URL + 'users' + (query ? query : '');
  //     const headers = new HttpHeaders().set('Content-Type', 'application/json');
  //     return this.http.get(url, { 'headers': headers }).pipe(map((res: any) => {
  //         let a: User[] = [];
  //         if (res.data && res.data.length > 0) {
  //             for (let i = 0; i < res.data.length; i++) {
  //                 a.push(new User(res.data[i]));
  //             }
  //         }
  //         return a;
  //     }),
  //         catchError((err) => {
  //             return observableThrowError(err.message || err);
  //         }), );
  // }

  // getUser(id: number): Observable<User> {
  //     const url = this.API_URL + 'users/' + id;
  //     const headers = new HttpHeaders().set('Content-Type', 'application/json');
  //     return this.http.get(url, { 'headers': headers }).pipe(map((res: any) => {
  //         return new User(res.data);
  //     }),
  //         catchError((err) => {
  //             return observableThrowError(err.message || err);
  //         }), );
  // }

  // saveUser(d: User): Observable<User> {
  //     const url = this.API_URL + 'users';
  //     const headers = new HttpHeaders().set('Content-Type', 'application/json');
  //     const data = {
  //         'id': d.id,
  //         'username': d.username,
  //         'email': d.email,
  //         'password': d.password,
  //         'first_name': d.first_name,
  //         'last_name': d.last_name,
  //         'portrait': d.portrait,
  //         'type': d.type,
  //     };
  // }

  // getUserList(query?: string): Observable<User[]> {
  //     const url = API_URL + 'users' + (query ? query : '');
  //     const headers = new HttpHeaders().set('Content-Type', 'application/json');
  //     return this.http.get(url, { 'headers': headers }).pipe(map((res: any) => {
  //         let a: User[] = [];
  //         if (res.data && res.data.length > 0) {
  //             for (let i = 0; i < res.data.length; i++) {
  //                 a.push(new User(res.data[i]));
  //             }
  //         }
  //         return a;
  //     }),
  //     catchError((err) => {
  //         return observableThrowError(err.message || err);
  //     }), );
  // }

  // getUser(id: number): Observable<User> {
  //     const url = this.API_URL + 'users/' + id;
  //     const headers = new HttpHeaders().set('Content-Type', 'application/json');
  //     return this.http.get(url, { 'headers': headers }).pipe(map((res: any) => {
  //         return new User(res.data);
  //     }),
  //     catchError((err) => {
  //         return observableThrowError(err.message || err);
  //     }), );
  // }

  // saveUser(d: User): Observable<User> {
  //     const url = this.API_URL + 'user';
  //     const headers = new HttpHeaders().set('Content-Type', 'application/json');
  //     const data = {
  //         'username': d.username,
  //         'first_name': d.first_name,
  //         'last_name': d.last_name,
  //         'portrait': d.portrait,
  //         'type': d.type,
  //     };

  //     return this.http.post(url, data, { 'headers': headers }).pipe(map((res: any) => {
  //         return new User(res.data);
  //     }),
  //     catchError((err) => {
  //         return observableThrowError(err.message || err);
  //     }), );
  // }


}

