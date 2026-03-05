"use client";

import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import { Category, ThreadSummary } from "@/types/thread";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

function ThreadsHomePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState(
    searchParams.get("category") ?? "all"
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);

        const [extractCategories, extractThreads] = await Promise.all([
          apiGet<Category[]>(apiClient, "/api/threads/categories"),
          apiGet<ThreadSummary[]>(apiClient, "/api/threads/threads", {
            params: {
              category:
                activeCategory && activeCategory !== "all"
                  ? activeCategory
                  : undefined,
              q: search || undefined,
            },
          }),
        ]);

        if (!isMounted) return;

        setCategories(extractCategories);
        setThreads(extractThreads);
      } catch (error) {
        console.log(error);
        // Handle error state incase of error and render
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [apiClient]);

  async function applyFilters(
    currentCategoryVal: string,
    currentSearchVal: string
  ) {
    const params = new URLSearchParams();

    if (currentCategoryVal && currentCategoryVal !== "all") {
      params.set("category", currentCategoryVal);
    }

    if (currentSearchVal.trim()) {
      params.set("q", currentSearchVal.trim());
    }

    router.push(`?${params.toString()}`);

    setIsLoading(true);

    try {
      const threadsListAfterSearchAndFilter = await apiGet<ThreadSummary[]>(
        apiClient,
        "/api/threads/threads",
        {
          params: {
            category:
              currentCategoryVal && currentCategoryVal !== "all"
                ? currentCategoryVal
                : undefined,
            q: currentSearchVal || undefined,
          },
        }
      );

      setThreads(threadsListAfterSearchAndFilter);
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-72">
        <Card className="sticky top-24 border-sidebar-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Categories</CardTitle>
              <Link href="/threads/new">
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/40"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => {
                setActiveCategory("all");
                applyFilters("all", search);
              }}
              className="cursor-pointer flex w-full items-center px-3 py-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-card/80 hover:text-foreground"
            >
              All categories
            </button>
            {isLoading && (
              <div className="flex items-center justify-center rounded-lg border border-border bg-card py-10">
                <p className="text-sm text-muted-foreground">
                  Loading Categories...
                </p>
              </div>
            )}
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => {
                  setActiveCategory(cat.slug);
                  applyFilters(cat.slug, search);
                }}
                className="cursor-pointer flex w-full items-center px-3 py-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-card/80 hover:text-foreground"
              >
                {cat.name}
              </button>
            ))}
          </CardContent>
        </Card>
      </aside>

      <div className="flex-1 space-y-6">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Latest Threads
            </h1>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10 bg-secondary/80 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    placeholder="Search Threads..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        applyFilters(activeCategory, search);
                      }
                    }}
                  />
                </div>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Search
                </Button>
              </div>
            </div>

            <Link href="/threads/new">
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto">
                <Plus className="w-4 h-4" />
                New Thread
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card py-10">
              <p className="text-sm text-muted-foreground">
                Loading Threads...
              </p>
            </div>
          )}

          {!isLoading && threads.length === 0 && (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No threads found. Create your first thread
                </p>
              </CardContent>
            </Card>
          )}
          {!isLoading &&
            threads.map((thread) => (
              <Card
                key={thread.id}
                className="group cursor-pointer border-border/70 bg-card transition-colors duration-150 hover:border-primary/90 hover:bg-card/90"
              >
                <Link href={`threads/${thread.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge
                            variant="outline"
                            className="border-border/70 bg-secondary/70 text-[12px]"
                          >
                            {thread.category.name}
                          </Badge>
                          {thread?.author?.handle && (
                            <span className="text-muted-foreground/90">
                              by @{thread?.author?.handle}
                            </span>
                          )}
                          <span className="text-muted-foreground/85">
                            {new Date(thread.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary">
                          {thread.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {thread.excerpt}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}

export default ThreadsHomePage;
