import { NextRequest, NextResponse } from 'next/server';
import { listU9SalesOrders, upsertU9SalesOrders, listProducts, upsertProducts } from '@/lib/mes-service';
import { u9Client, type U9SalesOrder, type U9Product } from '@/lib/u9-client';

export async function GET(_request: NextRequest) {
  try {
    const salesOrders = await listU9SalesOrders();
    return NextResponse.json({ success: true, data: salesOrders });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询 U9 销售订单失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function toSalesOrderRow(so: U9SalesOrder) {
  return {
    sales_order_no: so.salesOrderNo,
    customer_code: so.customerCode,
    customer_name: so.customerName,
    product_code: so.productCode,
    product_name: so.productName,
    specification: null,
    quantity: so.quantity,
    unit: so.unit,
    delivery_date: so.deliveryDate,
    status: so.status,
  };
}

function toProductRow(p: U9Product) {
  return {
    code: p.code,
    name: p.name,
    specification: p.specification,
    unit: p.unit,
    process_route: p.processRoute,
  };
}

export async function POST(_request: NextRequest) {
  try {
    const [soData, prodData] = await Promise.all([
      u9Client.fetchSalesOrders(),
      u9Client.fetchProducts(),
    ]);

    if (soData.length > 0) {
      await upsertU9SalesOrders(soData.map(toSalesOrderRow));
    }
    if (prodData.length > 0) {
      await upsertProducts(prodData.map(toProductRow));
    }

    const salesOrders = await listU9SalesOrders();
    const products = await listProducts();
    return NextResponse.json({
      success: true,
      data: { salesOrders, products, syncedCount: soData.length, syncedProductCount: prodData.length },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '同步 U9 数据失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
