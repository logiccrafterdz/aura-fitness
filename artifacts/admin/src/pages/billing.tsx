import { useState } from "react";
import { useInvoices, usePayments } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Billing() {
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const limit = 10;

  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices(invoicePage, limit);
  const { data: paymentsData, isLoading: isLoadingPayments } = usePayments(paymentPage, limit);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage invoices and payments.</p>
        </div>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        
        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="relative">
                {isLoadingInvoices ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoicesData?.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No invoices found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        invoicesData?.data?.map((invoice: any) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{invoice.member?.firstName} {invoice.member?.lastName}</TableCell>
                            <TableCell>
                              {new Intl.NumberFormat("en-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(invoice.total)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">View</Button>
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

        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b flex justify-end">
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Record Payment
                </Button>
              </div>
              <div className="relative">
                {isLoadingPayments ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsData?.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No payments found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paymentsData?.data?.map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell className="text-sm">
                              {format(new Date(payment.createdAt), "MMM d, yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="font-medium">
                              {payment.invoice?.invoiceNumber}
                            </TableCell>
                            <TableCell>
                              {new Intl.NumberFormat("en-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(payment.amount)}
                            </TableCell>
                            <TableCell className="capitalize">{payment.method?.replace("_", " ")}</TableCell>
                            <TableCell>
                              <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                                {payment.status}
                              </Badge>
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
