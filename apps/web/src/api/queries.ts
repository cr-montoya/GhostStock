import type { CreateProductsRequest, Product, Settings, UpdateProductRequest } from "@ghoststock/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProducts, deleteProduct, listProducts, updateProduct } from "./products";
import { getSettings, updateSettings } from "./settings";

export const queryKeys = {
  products: ["products"] as const,
  settings: ["settings"] as const,
};

export function useProducts() {
  return useQuery({ queryKey: queryKeys.products, queryFn: listProducts });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: getSettings });
}

export function useCreateProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateProductsRequest) => createProducts(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

/** Optimistic update with rollback (spec 02, 8.3). */
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateProductRequest }) => updateProduct(id, changes),
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products });
      const previous = queryClient.getQueryData<Product[]>(queryKeys.products);
      queryClient.setQueryData<Product[]>(queryKeys.products, (list) =>
        list?.map((product) => (product.id === id ? { ...product, ...changes } : product)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.products, context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Product[]>(queryKeys.products, (list) =>
        list?.map((product) => (product.id === updated.id ? updated : product)),
      );
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Product[]>(queryKeys.products, (list) => list?.filter((p) => p.id !== id));
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Settings) => updateSettings(settings),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.settings, saved),
  });
}
