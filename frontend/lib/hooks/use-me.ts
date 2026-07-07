"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMe, logout } from "@/lib/api/auth";

/** Owner session state. `me` is null when logged out. */
export function useMe() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return { me: query.data ?? null, isLoading: query.isLoading };
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
    },
  });
}
