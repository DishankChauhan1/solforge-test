// This file contains global type definitions
interface TrustedTypePolicyOptions {
  createHTML?: (input: string) => string;
  createScript?: (input: string) => string;
  createScriptURL?: (input: string) => string;
}

interface TrustedTypePolicy {
  name: string;
  createHTML(input: string): TrustedHTML;
  createScript(input: string): TrustedScript;
  createScriptURL(input: string): TrustedScriptURL;
}

interface TrustedHTML {}
interface TrustedScript {}
interface TrustedScriptURL {}

interface TrustedTypePolicyFactory {
  createPolicy(
    policyName: string, 
    policyOptions: TrustedTypePolicyOptions
  ): TrustedTypePolicy;
  getAttributeType(
    tagName: string,
    attribute: string,
    elementNS?: string,
    attrNS?: string
  ): string | null;
  getPropertyType(
    tagName: string,
    property: string,
    elementNS?: string
  ): string | null;
  defaultPolicy: TrustedTypePolicy | null;
  emptyHTML: TrustedHTML;
  emptyScript: TrustedScript;
  emptyScriptURL: TrustedScriptURL;
}

declare global {
  interface Window {
    trustedTypes?: TrustedTypePolicyFactory;
  }
}

export {}; 