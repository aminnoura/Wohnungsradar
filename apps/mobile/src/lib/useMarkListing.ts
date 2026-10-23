import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { HANDLED_STATUSES, type Listing } from '@wr/shared';
import { useCallback, useEffect, useState } from 'react';
import { api, type FavoriteStatus } from './api';

type SearchPage = { total: number; items: Listing[] };

export interface LastAction {
  listing: Listing;
  status: FavoriteStatus | null;
  previous: FavoriteStatus | null;
}

/**
 * Set a listing's Merkliste status (or clear it with null). Applied/rejected/hidden listings vanish from
 * loaded search results immediately; `undo` restores the previous status for a few seconds.
 */
export function useMarkListing() {
  const qc = useQueryClient();
  const favs = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  const statusOf = useCallback((id: string) => favs.data?.find((f) => f.listing.id === id)?.status ?? null, [favs.data]);
  const [last, setLast] = useState<LastAction | null>(null);

  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 6000);
    return () => clearTimeout(t);
  }, [last]);

  const write = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FavoriteStatus | null }) => (status ? api.setFavorite(id, status) : api.removeFavorite(id)),
    onMutate: ({ id, status }) => {
      if (status && HANDLED_STATUSES.includes(status)) {
        qc.setQueriesData<InfiniteData<SearchPage>>({ queryKey: ['search'] }, (data) =>
          data && {
            ...data,
            pages: data.pages.map((p) => ({ total: Math.max(0, p.total - (p.items.some((l) => l.id === id) ? 1 : 0)), items: p.items.filter((l) => l.id !== id) })),
          },
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorites'] });
      qc.invalidateQueries({ queryKey: ['search'] });
      qc.invalidateQueries({ queryKey: ['map'] });
    },
  });

  const mark = useCallback(
    (listing: Listing, status: FavoriteStatus | null) => {
      const previous = statusOf(listing.id);
      write.mutate({ id: listing.id, status });
      setLast({ listing, status, previous });
    },
    [statusOf, write],
  );

  const undo = useCallback(() => {
    if (!last) return;
    write.mutate({ id: last.listing.id, status: last.previous });
    setLast(null);
  }, [last, write]);

  return { mark, undo, last, statusOf };
}
