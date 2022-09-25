{
  "targets": [
    {
      "target_name": "WiPryClarity",
      "sources": [ "WiPryClarity.cc" ],
      "include_dirs" : [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "libraries": [
        "-L/opt/local/lib",
        "-L<(module_root_dir)/thirdparty",
        "-lWiPryClarity",
        "-lusb-1.0",
        "-lpthread"
      ]
    }
  ],
}
