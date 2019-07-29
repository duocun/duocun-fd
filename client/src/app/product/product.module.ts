import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '../shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProductListComponent } from './product-list/product-list.component';
import { ProductGridComponent } from './product-grid/product-grid.component';
import { ProductRoutingModule } from './product-routing.module';
import { WarningDialogComponent } from '../shared/warning-dialog/warning-dialog.component';
import { CartModule } from '../cart/cart.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    FormsModule,
    ReactiveFormsModule,
    ProductRoutingModule,
    SharedModule,
    CartModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  declarations: [
    ProductListComponent,
    ProductGridComponent
  ],
  exports: [ProductListComponent, ProductGridComponent, WarningDialogComponent
  ],
  providers: [
  ],
  entryComponents: [WarningDialogComponent]
})
export class ProductModule { }
