import { Manifold } from "@/lib/vendor/manifold-sdk";

let _manifold = new Manifold();

export const getManifoldApi = () => _manifold;
export const initManifoldApi = (apiKey?: string) => {
  _manifold = new Manifold(apiKey);
};
