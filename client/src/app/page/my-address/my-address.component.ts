import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
// import { ILocation, ILatLng } from '../../shared/location/location.model';

import { SharedService } from '../../shared/shared.service';
import { AuthService } from '../../account/auth.service';
import { environment } from '../../../environments/environment';
// import { LocationService } from '../../shared/location/location.service';
import { Restaurant } from '../../lb-sdk';


declare var google;
const APP = environment.APP;

@Component({
  selector: 'app-my-address',
  templateUrl: './my-address.component.html',
  styleUrls: ['./my-address.component.scss'],
  providers: [AuthService]
})
export class MyAddressComponent implements OnInit {

  keyword: string;
  query: any;
  filter: any;
  restaurantList: Restaurant[];
  places: any[] = [];
  center: any;
  gAutocomplete: any;
  coords: any;
  geoError: any;
  placeholder = 'Delivery Address';
  deliveryAddress = '';

  @ViewChild('div') div: ElementRef;

  ngOnInit() {
    const self = this;

    const s = localStorage.getItem('location-' + APP);
    if (s) {
      self.router.navigate(['home']);
    }

    // Chrome no longer supports obtaining the user's location using
    // the HTML5 Geolocation API from pages delivered by non-secure connections.
    // navigator.geolocation.getCurrentPosition(geo => {
    //   this.coords = geo;
    // }, err => {
    //   this.geoError = err;
    // });
  }

  constructor(private router: Router,
    private sharedSvc: SharedService,
    // private locationSvc: LocationService
  ) { }

  onAddressChange(e) {
    localStorage.setItem('location-' + APP, JSON.stringify(e.addr));
    this.deliveryAddress = e.sAddr;
    this.sharedSvc.emitMsg({ name: 'OnUpdateAddress', addr: e.addr });
  }

  search() {
    const self = this;
    if (this.deliveryAddress) {
      this.router.navigate(['home']);
    } else {
      this.useCurrentLocation();
    }
  }

  useCurrentLocation() {
    const self = this;
    // this.locationSvc.getCurrentLocation().subscribe((r: any) => {
    //   localStorage.setItem('location-' + APP, JSON.stringify(r));
    //   self.deliveryAddress = self.locationSvc.getAddrString(r);
    //   self.sharedSvc.emitMsg({ name: 'OnUpdateAddress', addr: r });
    //   self.router.navigate(['home']);
    // },
    // err => {
    //   console.log(err);
    //   // alert('Do you want to turn on your GPS to find the nearest restaurants?');
    // });
  }


}
