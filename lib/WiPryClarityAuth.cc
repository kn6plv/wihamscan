
#define NAPI_DISABLE_CPP_EXCEPTIONS 1

#include <stdio.h>
#include <napi.h>
#include "thirdparty/WiPryClarity.h"

using namespace oscium;

enum {
    RSSIDATA = 1,
    CONNECTED = 2,
};

Napi::ThreadSafeFunction threadSafeCallback;

class MyMonitor : public WiPryClarityDelegate, public Napi::ObjectWrap<MyMonitor> {
    public:
        explicit MyMonitor(const Napi::CallbackInfo& info) : Napi::ObjectWrap<MyMonitor>(info) {
            wipry = new WiPryClarity();
            //wipry->setDelegate(this);
        }

        ~MyMonitor() {
            delete wipry;
        }

        bool open(int band) {
            //printf("open %d\n", band);
            this->band = (oscium::WiPryClarity::DataType)band;
            bool r = wipry->startCommunication();
            //printf("r = %d\n", r);
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
        oscium::WiPryClarity::DataType band;

        // WiPryClarityDelegate
    
        void wipryClarityDidConnect(WiPryClarity *aWipryClarity) {
            //printf("connected\n");
            wipry->getEvenRssiLimts(&this->min[0], &this->max[0], &this->noise[0]);
            wipry->getOddRssiLimts(&this->min[1], &this->max[1], &this->noise[1]);
            switch ((WiPryClarity::DataType)this->band) {
                case WiPryClarity::DataType::RSSI_2_4GHZ:
                    wipry->get2_4GHzBoundary(&this->minFreq, &this->maxFreq);
                    break;
                case WiPryClarity::DataType::RSSI_5GHZ:
                    wipry->get5GHzBoundary(&this->minFreq, &this->maxFreq);
                    break;
                case WiPryClarity::DataType::RSSI_6E:
                    wipry->get6EBoundary(&this->minFreq, &this->maxFreq);
                    break;
                case WiPryClarity::DataType::RSSI_DUAL25:
                default:
                    break;
            }
            //printf("startRssiData\n");
            wipry->startRssiData(this->band, 0, 0, 0);

            auto callback = [this](Napi::Env env, Napi::Function jsCallback) {
                jsCallback.Call({
                    Napi::Number::New(env, CONNECTED),
                    Napi::Boolean::New(env, true),
                    Napi::Number::New(env, this->min[0]),
                    Napi::Number::New(env, this->max[0]),
                    Napi::Number::New(env, this->noise[0]),
                    Napi::Number::New(env, this->min[1]),
                    Napi::Number::New(env, this->max[1]),
                    Napi::Number::New(env, this->noise[1]),
                    Napi::Number::New(env, this->minFreq),
                    Napi::Number::New(env, this->maxFreq),
                });
            };
            threadSafeCallback.NonBlockingCall(callback);
        }

        void wipryClarityUnableToConnect(WiPryClarity *wipryClarity, WiPryClarity::ErrorCode errorCode) {
            //printf("unconnected\n");
            auto callback = [](Napi::Env env, Napi::Function jsCallback) {
                jsCallback.Call({
                    Napi::Number::New(env, CONNECTED),
                    Napi::Boolean::New(env, false)
                });
            };
            threadSafeCallback.NonBlockingCall(callback);
        }

        void wipryClarityDidReceiveRSSIData(WiPryClarity *aWipryClarity, WiPryClarity::DataType dataType, std::vector<float> rssiData) {
            //printf("rssidata\n");
            switch (dataType) {
                case WiPryClarity::DataType::RSSI_2_4GHZ:
                case WiPryClarity::DataType::RSSI_5GHZ:
                case WiPryClarity::DataType::RSSI_6E:
                case WiPryClarity::DataType::RSSI_DUAL25:
                {
                    auto callback = [dataType, rssiData](Napi::Env env, Napi::Function jsCallback) {
                        auto arr = Napi::Float32Array::New(env, rssiData.size());
                        for (size_t i = 0; i < rssiData.size(); i++) {
                            arr[i] = rssiData[i];
                        }
                        jsCallback.Call({
                            Napi::Number::New(env, RSSIDATA),
                            Napi::Number::New(env, (int)dataType),
                            arr
                        });
                    };
                    threadSafeCallback.NonBlockingCall(callback);
                    break;
                }
                default:
                    break;
            }
        }

        void wipryClarityDidReceiveBeaconCaptureData(WiPryClarity *wipryClarity, std::vector<uint8_t> beaconCaptures) {
        }

        float minFreq;
        float maxFreq;
        float min[2];
        float max[2];
        float noise[2];

        void Open(const Napi::CallbackInfo& info) {
            this->open((int)info[0].As<Napi::Number>());
        }

        void Close(const Napi::CallbackInfo& info) {
            this->close();
        }

        void RegisterCallback(const Napi::CallbackInfo& info) {
            Napi::Env env = info.Env();
            Napi::Function func = info[0].As<Napi::Function>();
            threadSafeCallback = Napi::ThreadSafeFunction::New(env, func, "Callback", 0, 1);
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
