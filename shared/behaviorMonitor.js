// DOM adapter: observe field types and intended submissions, never field values.
(() => {
  "use strict";

  function isCredentialField(field, form) {
    return Boolean(field && field.tagName === "INPUT" && field.form === form &&
      field.name && !field.disabled && !field.matches(":disabled") &&
      (field.type === "password" ||
        /(?:^|\s)(?:current-password|new-password|one-time-code)(?:\s|$)/i.test(field.autocomplete || "")));
  }

  function getSubmission(form, submitter, pageUrl) {
    const button = submitter?.form === form ? submitter : null;
    const rawAction = button?.hasAttribute("formaction")
      ? button.getAttribute("formaction") : form.getAttribute("action");
    let destinationUrl = "";
    try {
      destinationUrl = new URL(rawAction || pageUrl, form.ownerDocument?.baseURI || pageUrl).href;
    } catch (_) { /* An unreadable destination is not proof of a transfer. */ }
    const rawMethod = button?.hasAttribute("formmethod")
      ? button.getAttribute("formmethod") : form.getAttribute("method");
    const method = ["post", "dialog"].includes(String(rawMethod).toLowerCase())
      ? String(rawMethod).toUpperCase() : "GET";
    // Named controls can shadow form.elements; prefer the browser's native getter.
    const elementsGetter = Object.getOwnPropertyDescriptor(globalThis.HTMLFormElement?.prototype || {}, "elements")?.get;
    const elements = elementsGetter ? elementsGetter.call(form) : form.elements;
    const credential = Array.from(elements || []).some(field => isCredentialField(field, form));
    return {
      destinationUrl,
      method,
      credential,
      // Used only for a synchronous, one-use approval; never exported as evidence.
      intentKey: JSON.stringify([destinationUrl, method, credential,
        button?.hasAttribute("formtarget") ? button.getAttribute("formtarget") : form.getAttribute("target"),
        button?.hasAttribute("formenctype") ? button.getAttribute("formenctype") : form.getAttribute("enctype")])
    };
  }

  function createMonitor(options = {}) {
    const correlator = globalThis.AI_GUARDIAN_BEHAVIOR.createCorrelator(options);
    let forms = new WeakMap();
    let nextForm = 0;
    let currentPage = "";
    function reset() {
      correlator.reset();
      forms = new WeakMap();
      nextForm = 0;
      currentPage = "";
    }
    function syncPage(pageUrl) {
      if (currentPage && currentPage !== pageUrl) reset();
      currentPage = pageUrl;
    }
    function formId(form) {
      if (!forms.has(form)) forms.set(form, `form-${++nextForm}`);
      return forms.get(form);
    }
    return {
      interaction(event, pageUrl) {
        syncPage(pageUrl);
        const field = event.target;
        const form = field?.form;
        if (!event.isTrusted || !["input", "focusin"].includes(event.type) || !form ||
            !isCredentialField(field, form) || field.closest?.("#ai-guardian-root, #ai-guardian-modal-root")) {
          return correlator.getSummary();
        }
        return correlator.observe({
          type: "credential-interaction", formId: formId(form), pageUrl,
          ...getSubmission(form, null, pageUrl)
        });
      },
      submit(form, submitter, pageUrl, details = {}) {
        syncPage(pageUrl);
        const intent = getSubmission(form, submitter, pageUrl);
        const summary = correlator.observe({
          type: "form-submit", formId: formId(form), pageUrl,
          ...intent, suspiciousDestination: details.suspiciousDestination === true,
          stage: details.stage || "attempted"
        });
        return { intent, summary, current: summary.current };
      },
      getSummary: () => correlator.getSummary(),
      reset
    };
  }
  globalThis.AI_GUARDIAN_BEHAVIOR_MONITOR = Object.freeze({ createMonitor, getSubmission });
})();
