
#define NAPI_DISABLE_CPP_EXCEPTIONS 1

#include <stdio.h>
#include <napi.h>
#include "thirdparty/WiPryClarity.h"

using namespace oscium;

class MyMonitor : public WiPryClarityDelegate, public Napi::ObjectWrap<MyMonitor> {
    public:
        explicit MyMonitor(const Napi::CallbackInfo& info) : Napi::ObjectWrap<MyMonitor>(info) {
            wipry = new WiPryClarity();
            wipry->setDelegate(this);
        }

        ~MyMonitor() {
            delete wipry;
        }

        bool open() {
            bool r = wipry->startCommunication();
            if (!r) {
                return false;
            }
            return true;
        }

        void close() {
            if (wipry->didStartCommunication()) {
                wipry->endCommunication();
            }
        }

        WiPryClarity* wipry;

        // WiPryClarityDelegate
    
        void wipryClarityDidConnect(WiPryClarity *aWipryClarity) {
        }

        void wipryClarityUnableToConnect(WiPryClarity *wipryClarity, WiPryClarity::ErrorCode errorCode) {
        }

        void wipryClarityDidReceiveRSSIData(WiPryClarity *aWipryClarity, WiPryClarity::DataType dataType, std::vector<float> rssiData) {
        }

        void wipryClarityDidReceiveBeaconCaptureData(WiPryClarity *wipryClarity, std::vector<uint8_t> beaconCaptures) {
        }

        void Open(const Napi::CallbackInfo& info) {
            this->open();
        }

        void Close(const Napi::CallbackInfo& info) {
            this->close();
        }

        static Napi::Object Init(Napi::Env env, Napi::Object exports) {
            Napi::Function func = DefineClass(env, "MyMonitor", {
                InstanceWrap::InstanceMethod("open", &MyMonitor::Open),
                InstanceMethod("close", &MyMonitor::Close),
                InstanceMethod("registerCallback", &MyMonitor::RegisterCallback)
            });

            Napi::FunctionReference* constructor = new Napi::FunctionReference();
            *constructor = Napi::Persistent(func);
            env.SetInstanceData(constructor);

            exports.Set("MyMonitor", func);
            return exports;
        }
};

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return MyMonitor::Init(env, exports);
}

NODE_API_MODULE(WiPryClarity, InitAll);
