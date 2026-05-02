import { useState } from "react";
import { useProducts, useOrders } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function Store() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: productsData, isLoading: isLoadingProducts } = useProducts();
  const { data: ordersData, isLoading: isLoadingOrders } = useOrders(page, limit);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Store</h1>
          <p className="text-muted-foreground mt-1">Manage products and point-of-sale orders.</p>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="products" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b flex justify-end">
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Add Product
                </Button>
              </div>
              <div className="relative">
                {isLoadingProducts ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsData?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No products found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        productsData?.data?.map((product: any) => {
                          const isLowStock = product.stockQuantity <= product.lowStockThreshold;
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>{product.category}</TableCell>
                              <TableCell>
                                {new Intl.NumberFormat("en-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(product.price)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {product.stockQuantity}
                                  {isLowStock && (
                                    <AlertCircle className="w-4 h-4 text-destructive" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={product.isActive ? 'default' : 'secondary'}>
                                  {product.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">Edit</Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="relative">
                {isLoadingOrders ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersData?.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No orders found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        ordersData?.data?.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell className="text-sm">
                              {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="font-medium">
                              {new Intl.NumberFormat("en-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(order.total)}
                            </TableCell>
                            <TableCell>{order.itemsCount} items</TableCell>
                            <TableCell>
                              <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">View Details</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
