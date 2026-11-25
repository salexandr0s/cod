#pragma once

#include "HybridCod3HighlightsSpec.hpp"

namespace margelo::nitro::cod3highlights {

class HybridCod3Highlights : public HybridCod3HighlightsSpec {
public:
  HybridCod3Highlights() : HybridObject(TAG) {}

  std::optional<std::shared_ptr<ArrayBuffer>> tokenize(SourceText source,
                                                       double language) override;
};

} // namespace margelo::nitro::cod3highlights
