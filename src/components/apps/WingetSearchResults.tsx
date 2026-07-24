import { useState } from "react";
import { Plus, Check, Loader2, Info, ExternalLink } from "lucide-react";
import { api } from "../../lib";
import { useAppStore } from "../../stores/appStore";

interface WingetSearchResult {
  name: string;
  id: string;
  version: string;
  source: string;
}

interface WingetPackageDetails {
  id: string;
  name: string;
  version: string;
  publisher: string | null;
  description: string | null;
  homepage: string | null;
  license: string | null;
}

interface WingetSearchResultsProps {
  results: WingetSearchResult[];
  isSearching: boolean;
}

export function WingetSearchResults({ results, isSearching }: WingetSearchResultsProps) {
  const { selectedIds, toggleApp, catalog } = useAppStore();
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [details, setDetails] = useState<WingetPackageDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const catalogIds = new Set(catalog.map((a) => a.id));

  const handleShowDetails = async (packageId: string) => {
    if (detailsFor === packageId) {
      setDetailsFor(null);
      setDetails(null);
      return;
    }
    setDetailsFor(packageId);
    setLoadingDetails(true);
    try {
      const info = await api.getWingetPackageInfo({
        packageId,
      });
      setDetails(info);
    } catch {
      setDetails(null);
    }
    setLoadingDetails(false);
  };

  if (isSearching) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Searching winget repository...</span>
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          Results from winget repository
        </h2>
        <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">
          {results.length}
        </span>
      </div>

      <div className="space-y-1">
        {results.map((result) => {
          const isInCatalog = catalogIds.has(result.id);
          const isSelected = selectedIds.has(result.id);
          const isExpanded = detailsFor === result.id;

          return (
            <div key={result.id}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 ${
                  isSelected
                    ? "bg-accent-muted border-accent/50"
                    : "bg-bg-card border-border hover:bg-bg-card-hover hover:border-border-hover"
                }`}
              >
                {/* Add/Selected button */}
                <button
                  onClick={() => toggleApp(result.id)}
                  className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-accent text-bg-primary"
                      : "bg-bg-tertiary text-text-muted hover:text-accent hover:bg-accent-muted"
                  }`}
                >
                  {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {result.name}
                    </span>
                    {isInCatalog && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent/20 text-accent shrink-0">
                        In Catalog
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted font-mono truncate">{result.id}</p>
                </div>

                {/* Version */}
                <span className="text-xs text-text-muted font-mono shrink-0">{result.version}</span>

                {/* Details button */}
                <button
                  onClick={() => handleShowDetails(result.id)}
                  className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors shrink-0"
                  title="Show details"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="ml-10 px-4 py-3 mb-1 rounded-b-lg bg-bg-tertiary border border-t-0 border-border animate-fade-in">
                  {loadingDetails ? (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs">Loading details...</span>
                    </div>
                  ) : details ? (
                    <div className="space-y-1.5 text-xs">
                      {details.publisher && (
                        <p className="text-text-secondary">
                          <span className="text-text-muted">Publisher:</span> {details.publisher}
                        </p>
                      )}
                      {details.description && (
                        <p className="text-text-secondary">
                          <span className="text-text-muted">Description:</span>{" "}
                          {details.description}
                        </p>
                      )}
                      {details.license && (
                        <p className="text-text-secondary">
                          <span className="text-text-muted">License:</span> {details.license}
                        </p>
                      )}
                      {details.homepage && (
                        <a
                          href={details.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Homepage
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">Could not load package details.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
