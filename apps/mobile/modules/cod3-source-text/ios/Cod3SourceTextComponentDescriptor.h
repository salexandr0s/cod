#pragma once

#include "Cod3SourceTextShadowNode.h"

#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {
using Cod3SourceTextComponentDescriptor =
    ConcreteComponentDescriptor<Cod3SourceTextShadowNode>;

void Cod3SourceTextSpec_registerComponentDescriptorsFromCodegen(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);
} // namespace facebook::react
