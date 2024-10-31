/**

*/

export const GET = (request: Request) => {
  const url = new URL(request.url);
  //input: source, destination (and authentication for it)
  const [source, destination] = url.pathname.split("...");
  //preprocessing: from source + destination: calculate the previous date of destination, then get diff (via uithub)

  /**
  internal:
  - prepare file data
  - calculate workflow
  - execute workflow 
  */

  /**
  Output:
  - A file object of static files for the destination
  - A lazy fallback URL (can be inside of a config file)
   */

  /** post-processing: Submit this new output to a repo/branch on github or similar or into a zip or r2 storage object. We now just need an npmjz URL as response */
};
