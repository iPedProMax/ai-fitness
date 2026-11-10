import {describe,expect,it} from "vitest";
import {parseCachedCatalog, BARCODE_CACHE_TTL_MS,catalogCacheKey} from "./barcode-cache";
const food={barcode:"3017624010701",name:"Product",brand:"",servingDescription:"30 g",calories100g:80,protein100g:null,carbs100g:null,fat100g:null};
describe("bounded barcode cache",()=>{
  it("preserves recent public records",()=>expect(parseCachedCatalog(JSON.stringify({foods:[food],fetchedAt:1000}),2000)?.foods).toHaveLength(1));
  it("rejects expired, future and corrupted data",()=>{
    expect(parseCachedCatalog(JSON.stringify({foods:[food],fetchedAt:1000}),1000+BARCODE_CACHE_TTL_MS+1)).toBeNull();
    expect(parseCachedCatalog(JSON.stringify({foods:[food],fetchedAt:3000}),2000)).toBeNull();
    expect(parseCachedCatalog("{garbage")).toBeNull();
  });
  it("normalizes only the search key",()=>expect(catalogCacheKey("q","  Tuna  ")).toBe(catalogCacheKey("q","tuna")));
});
