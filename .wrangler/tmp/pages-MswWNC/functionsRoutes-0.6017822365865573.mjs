import { onRequestPost as __api_gpt_js_onRequestPost } from "E:\\Agent\\SPACE_DEBRIES_NEW\\functions\\api\\gpt.js"
import { onRequestGet as __api_health_js_onRequestGet } from "E:\\Agent\\SPACE_DEBRIES_NEW\\functions\\api\\health.js"
import { onRequestGet as __api_satellite_js_onRequestGet } from "E:\\Agent\\SPACE_DEBRIES_NEW\\functions\\api\\satellite.js"
import { onRequestPost as __api_test_gpt_js_onRequestPost } from "E:\\Agent\\SPACE_DEBRIES_NEW\\functions\\api\\test-gpt.js"

export const routes = [
    {
      routePath: "/api/gpt",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_gpt_js_onRequestPost],
    },
  {
      routePath: "/api/health",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_health_js_onRequestGet],
    },
  {
      routePath: "/api/satellite",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_satellite_js_onRequestGet],
    },
  {
      routePath: "/api/test-gpt",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_test_gpt_js_onRequestPost],
    },
  ]