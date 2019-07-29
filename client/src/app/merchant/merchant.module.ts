import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MerchantRoutingModule } from './merchant-routing.module';
import { MerchantListComponent } from './merchant-list/merchant-list.component';
import { MerchantDetailPageComponent } from './merchant-detail-page/merchant-detail-page.component';
import { ProductModule } from '../product/product.module';

import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '../../../node_modules/@angular/material';
import { CartModule } from '../cart/cart.module';
import { QuitRestaurantDialogComponent } from './quit-restaurant-dialog/quit-restaurant-dialog.component';


@NgModule({
  declarations: [MerchantListComponent,
    MerchantDetailPageComponent,
    QuitRestaurantDialogComponent
  ],
  imports: [
    CommonModule,
    MatTabsModule,
    MatDialogModule,
    MerchantRoutingModule,
    ProductModule,
    CartModule
  ],
  exports: [MerchantListComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  entryComponents: [QuitRestaurantDialogComponent]
})
export class MerchantModule { }
