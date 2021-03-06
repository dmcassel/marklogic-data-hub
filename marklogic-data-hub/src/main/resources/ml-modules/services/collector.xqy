(:
  Copyright 2012-2016 MarkLogic Corporation

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
:)
xquery version "1.0-ml";

module namespace service = "http://marklogic.com/rest-api/resource/collector";

import module namespace debug = "http://marklogic.com/data-hub/debug"
  at "/com.marklogic.hub/lib/debug-lib.xqy";

import module namespace flow = "http://marklogic.com/data-hub/flow-lib"
  at "/com.marklogic.hub/lib/flow-lib.xqy";

import module namespace perf = "http://marklogic.com/data-hub/perflog-lib"
  at "/com.marklogic.hub/lib/perflog-lib.xqy";

declare option xdmp:mapping "false";

(:~
 : Builds a JSON response common to get and post
 :)
declare function service:build-response($items as item()*)
  as document-node()
{
  document {
    json:to-array($items) ! xdmp:to-json(.)
  }
};

(:
  Allows the client to send in the collector name and options.
  Useful for testing a collector without needing a flow
:)
declare function post(
  $context as map:map,
  $params  as map:map,
  $input   as document-node()*
  ) as document-node()*
{
  debug:dump-env(),

  perf:log('/v1/resources/collector:post', function() {
    (:let $options := $input/node():)
    let $module-uri as xs:string := map:get($params, "module-uri")
    let $options as map:map := (
      map:get($params, "options") ! xdmp:unquote(.)/object-node(),
      map:map()
    )[1]
    return
      service:build-response(flow:run-collector($module-uri, $options))
  })
};

declare function get(
  $context as map:map,
  $params  as map:map
  ) as document-node()*
{
  debug:dump-env(),

  perf:log('/v1/resources/collector:get', function() {
    let $module-uri as xs:string := map:get($params, "module-uri")
    let $options as map:map := (
      map:get($params, "options") ! xdmp:unquote(.)/object-node(),
      map:map()
    )[1]
    return
      service:build-response(flow:run-collector($module-uri, $options))
  })
};
