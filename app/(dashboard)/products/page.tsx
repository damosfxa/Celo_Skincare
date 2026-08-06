"use client";

import { useProducts } from "@/hooks/useProducts";
import { CreateProductForm } from "@/components/products/create-product-form";
import { IntakeBatchForm } from "@/components/products/intake-batch-form";
import { OpeningBalanceForm } from "@/components/products/opening-balance-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Package, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function ProductsPage() {
  const { products, isLoading, isError } = useProducts();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Produk & Batch</h2>
          <p className="text-muted-foreground mt-1">
            Kelola daftar produk, stok saat ini, dan catat penerimaan barang maklon.
          </p>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:flex-shrink-0">
          <OpeningBalanceForm />
          <IntakeBatchForm />
          <CreateProductForm />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
          <CardDescription>
            Menampilkan seluruh produk yang terdaftar beserta total kuantitas di semua batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-destructive p-4 border rounded-md bg-destructive/10">
              Terjadi kesalahan saat memuat data produk.
            </div>
          ) : products.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
              Belum ada data produk. Silakan tambahkan produk baru.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">SKU</TableHead>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Total Stok (Pcs)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow 
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/products/${product.id}`)}
                    >
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        {product.is_bundle ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                            <Layers className="h-3.5 w-3.5" />
                            Bundle
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                            Fisik
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {product.current_qty?.toLocaleString("id-ID") || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
