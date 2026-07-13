/**
 * Renders one or more JSON-LD nodes into a <script> tag (PRD §13). Pass objects
 * built by `lib/seo.ts` or `lib/engine`.
 *
 * The node data is NOT trustworthy: it carries editor-authored strings (FAQ
 * answers, meta titles, custom JSON-LD) straight from the admin. `JSON.stringify`
 * does not escape `<`, so a `</script>` inside any of those would close this tag
 * early and turn the rest of the string into live markup — stored XSS. Escaping
 * `<` as its < form keeps the JSON semantically identical (parsers decode the
 * escape) while making it impossible to break out of the script element.
 */
const serialize = (node: object) => JSON.stringify(node).replace(/</g, "\\u003c");

export function JsonLd({ data }: { data: object | object[] }) {
  const nodes = Array.isArray(data) ? data : [data];
  return (
    <>
      {nodes.map((node, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialize(node) }}
        />
      ))}
    </>
  );
}

export default JsonLd;
